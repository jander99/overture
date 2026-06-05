"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3BucketTemplate = S3BucketTemplate;
exports.isS3BucketConstructor = isS3BucketConstructor;
exports.isS3BucketDeploymentConstructor = isS3BucketDeploymentConstructor;
exports.getBucketProperty = getBucketProperty;
exports.findPropagatedSetting = findPropagatedSetting;
const index_js_1 = require("../index.js");
const cdk_js_1 = require("./cdk.js");
/**
 * A rule template for AWS S3 Buckets
 *
 * The rule template allows to detect sensitive configuration passed on
 * the invocation of S3 Bucket's constructor from AWS CDK:
 *
 * ```new s3.Bucket(...)```
 *
 * @param callback the callback invoked on visiting S3 Bucket's instantiation
 * @param meta the instantiated rule metadata
 * @returns the instantiated rule definition
 */
function S3BucketTemplate(callback, meta = {}) {
    return {
        meta,
        create(context) {
            return {
                NewExpression: (node) => {
                    if (isS3BucketConstructor(context, node)) {
                        callback(node, context);
                    }
                },
            };
        },
    };
}
/**
 * Detects S3 Bucket's constructor invocation from 'aws-cdk-lib/aws-s3':
 *
 * const s3 = require('aws-cdk-lib/aws-s3');
 * new s3.Bucket();
 */
function isS3BucketConstructor(context, node) {
    return (0, cdk_js_1.normalizeFQN)((0, index_js_1.getFullyQualifiedName)(context, node)) === 'aws_cdk_lib.aws_s3.Bucket';
}
/**
 * Detects S3 BucketDeployment's constructor invocation from 'aws-cdk-lib/aws-s3-deployment':
 *
 * const s3 = require('aws-cdk-lib/aws-s3-deployment');
 * new s3.BucketDeployment();
 */
function isS3BucketDeploymentConstructor(context, node) {
    return ((0, cdk_js_1.normalizeFQN)((0, index_js_1.getFullyQualifiedName)(context, node)) ===
        'aws_cdk_lib.aws_s3_deployment.BucketDeployment');
}
/**
 * Extracts a property from the configuration argument of S3 Bucket's constructor
 *
 * ```
 * new s3.Bucket(_, _, { // config
 *  key1: value1,
 *  ...
 *  keyN: valueN
 * });
 * ```
 *
 * @param context the rule context
 * @param bucket the invocation of S3 Bucket's constructor
 * @param key the key of the property to extract
 * @returns the extracted property
 */
function getBucketProperty(context, bucket, key) {
    const args = bucket.arguments;
    const optionsArg = args[2];
    const options = (0, index_js_1.getValueOfExpression)(context, optionsArg, 'ObjectExpression');
    if (options == null) {
        return null;
    }
    return options.properties.find(property => (0, index_js_1.isProperty)(property) && (0, index_js_1.isIdentifier)(property.key, key));
}
/**
 * Finds the propagated setting of a sensitive property
 */
function findPropagatedSetting(sensitiveProperty, propagatedValue) {
    const isPropagatedProperty = sensitiveProperty.value !== propagatedValue;
    if (isPropagatedProperty) {
        return (0, index_js_1.toSecondaryLocation)((0, index_js_1.getNodeParent)(propagatedValue), 'Propagated setting.');
    }
    return undefined;
}
