type Default = string | boolean | number | string[] | number[] | Object;
type ESLintConfigurationDefaultProperty = {
    default: Default;
};
/**
 * Necessary for the property to show up in the SonarQube interface.
 * @param description will explain to the user what the property configures
 * @param displayName only necessary if the name of the property is different from the `field` name
 * @param customDefault only necessary if different default in SQ different than in JS/TS
 * @param items only necessary if type is 'array'
 * @param fieldType only necessary if you need to override the default fieldType in SQ
 * @param customForConfiguration replacement content how to pass this variable to the Configuration object
 */
export type ESLintConfigurationSQProperty = ESLintConfigurationDefaultProperty & {
    description: string;
    displayName?: string;
    customDefault?: Default;
    items?: {
        type: 'string' | 'integer';
    };
    fieldType?: 'TEXT';
    customForConfiguration?: string;
};
export type ESLintConfigurationProperty = ESLintConfigurationDefaultProperty | ESLintConfigurationSQProperty;
type ESLintConfigurationNamedProperty = ESLintConfigurationProperty & {
    field: string;
};
type ESLintConfigurationElement = ESLintConfigurationNamedProperty[] | ESLintConfigurationProperty;
export type ESLintConfiguration = ESLintConfigurationElement[];
export declare function defaultOptions(configuration?: ESLintConfiguration): Default[] | undefined;
export {};
