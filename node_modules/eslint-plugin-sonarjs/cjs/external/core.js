"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getESLintCoreRule = getESLintCoreRule;
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
const use_at_your_own_risk_1 = require("eslint/use-at-your-own-risk");
function getESLintCoreRule(key) {
    return use_at_your_own_risk_1.builtinRules.get(key);
}
