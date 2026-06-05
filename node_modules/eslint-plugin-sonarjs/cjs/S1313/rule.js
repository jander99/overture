"use strict";
/*
 * SonarQube JavaScript Plugin
 * Copyright (C) 2011-2025 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the Sonar Source-Available License Version 1, as published by SonarSource SA.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */
// https://sonarsource.github.io/rspec/#/rspec/S1313/javascript
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rule = void 0;
const net_1 = require("net");
const index_js_1 = require("../helpers/index.js");
const meta = __importStar(require("./generated-meta.js"));
const netMaskRegex = /(^[^/]+)\/\d{1,3}$/;
const acceptedIpAddresses = ['255.255.255.255', '::1', '::', '0:0:0:0:0:0:0:1', '0:0:0:0:0:0:0:0'];
const ipV4Octets = 4;
const ipV4MappedToV6Prefix = '::ffff:0:';
const acceptedIpV6Starts = [
    // https://datatracker.ietf.org/doc/html/rfc3849
    '2001:db8:',
];
const acceptedIpV4Starts = [
    '127.',
    '0.',
    // avoid FP for OID http://www.oid-info.com/introduction.htm
    '2.5',
    // https://datatracker.ietf.org/doc/html/rfc5737
    '192.0.2.',
    '198.51.100.',
    '203.0.113.',
];
exports.rule = {
    meta: (0, index_js_1.generateMeta)(meta, {
        messages: {
            checkIP: 'Make sure using a hardcoded IP address {{ip}} is safe here.',
        },
    }),
    create(context) {
        function isException(ip) {
            return (acceptedIpV6Starts.some(prefix => ip.startsWith(prefix)) ||
                acceptedIpV4Starts.some(prefix => ip.startsWith(ipV4MappedToV6Prefix + prefix) || ip.startsWith(prefix)) ||
                acceptedIpAddresses.includes(ip));
        }
        function isIPV4OctalOrHex(ip) {
            const digits = ip.split('.');
            if (digits.length !== ipV4Octets) {
                return false;
            }
            const decimalDigits = [];
            for (const digit of digits) {
                if (digit.match(/^0[0-7]*$/)) {
                    decimalDigits.push(parseInt(digit, 8));
                }
                else if (digit.match(/^0[xX][0-9a-fA-F]+$/)) {
                    decimalDigits.push(parseInt(digit, 16));
                }
                else {
                    return false;
                }
            }
            const convertedIp = `${decimalDigits[0]}.${decimalDigits[1]}.${decimalDigits[2]}.${decimalDigits[3]}`;
            return !isException(convertedIp) && (0, net_1.isIP)(convertedIp) !== 0;
        }
        return {
            Literal(node) {
                const { value } = node;
                if (typeof value !== 'string') {
                    return;
                }
                let ip = value;
                const result = value.match(netMaskRegex);
                if (result) {
                    ip = result[1];
                }
                if ((!isException(ip) && (0, net_1.isIP)(ip) !== 0) || isIPV4OctalOrHex(ip)) {
                    context.report({
                        node,
                        messageId: 'checkIP',
                        data: {
                            ip: value,
                        },
                    });
                }
            },
        };
    },
};
