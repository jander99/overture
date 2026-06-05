/**
 * S1537 ('comma-dangle') and S3723 ('enforce-trailing-comma') both depend on the
 * same ESLint implementation, but the plugin doesn't allow rule key duplicates.
 */
export declare const rule: {
    meta: import("@eslint/core").RulesMeta<string, unknown[], unknown>;
    create(context: import("eslint").Rule.RuleContext): import("eslint").Rule.NodeListener;
};
