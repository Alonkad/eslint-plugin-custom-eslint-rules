'use strict'

const _ = require('lodash')
const types = ['VariableDeclaration', 'FunctionExpression', 'CallExpression', 'ExpressionStatement', 'ArrayExpression', 'Literal', 'ReturnStatement']
const namedTypes = _.reduce(types, (result, type) => {
    result[type] = {check: node => node.type === type}
    return result
}, {})


//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
    meta: {
        docs: {
            description: 'Prevents modules from declaring variables (saving state in their scope)',
            category: 'SSR',
            recommended: false
        },

        schema: []
    },

    create(context) {
        let moduleDependencies
        let moduleReturnedVar
        let frozenObjects

        /**
         * Reports a given node.
         * @param {Node} node - A node to report.
         * @returns {void}
         */
        function report(node) {
            context.report({
                node,
                message: `${node.id.name} defined in module scope.`,
                fix: null
            })
        }

        /**
         * Check if a given node is am AMD module (santa module)
         * @param {Node} node - A node to check.
         * @returns {boolean}
         */
        function isAmdModule(node) {
            const body = node.body
            const moduleIsWrappedWithDefine =
                body.length === 1 &&
                namedTypes.ExpressionStatement.check(body[0]) &&
                body[0].expression.callee &&
                body[0].expression.callee.name === 'define'

            if (!moduleIsWrappedWithDefine) {
                return false
            }

            const defineCall = body[0].expression

            if (!namedTypes.CallExpression.check(defineCall)) {
                return false
            }

            const defineArgs = _.clone(defineCall.arguments)
            if (defineArgs.length === 0 || defineArgs.length > 3) {
                return false
            }

            const defineTypes = [namedTypes.FunctionExpression, namedTypes.ArrayExpression, namedTypes.Literal]
            return _(defineArgs)
                .reverse()
                .every((arg, index) => defineTypes[index].check(arg))
        }

        /**
         * Extracts variables declarations from a given node
         * @param {Node} node - A node to check.
         * @returns {array}
         */
        function getAllGlobalVars(node) {
            return _(node.body)
                .filter(namedTypes.VariableDeclaration.check)
                .filter({kind: 'var'})
                .flatMap('declarations')
                // .map('id')
                .value()
        }

        function filterAllowed(allGlobalVars) {
            const toFilter = _.filter(allGlobalVars, node =>
                node.init &&
                (
                    isLiteral(node) ||
                    isFunction(node) ||
                    isArrayWithValues(node) ||
                    isUpperCase(node) ||
                    isReturnedObject(node) ||
                    isFrozen(node) ||
                    isReactCreate(node) ||
                    isSantaType(node) ||
                    isDep(node) ||
                    isRegex(node) ||
                    isConstObject(node) ||
                    isBinaryExpression(node)
                )
            )

            return _.difference(allGlobalVars, toFilter)
        }

        function isUpperCase(node) {
            const name = node.id && node.id.name
            return name && name === name.toUpperCase()
        }

        function isDep(node) {
            const type = getProp(node, 'type')
            const nodeName = getProp(node, 'name')
            const object = getProp(node, 'object')
            let name

            if (type === 'Identifier' && nodeName) {
                name = nodeName
            } else if (type === 'MemberExpression') {
                name = getObjectName(object)
            }

            return _.includes(moduleDependencies, name)
        }

        function isLiteral(node) {
            const type = getProp(node, 'type')
            const argType = node.init && node.init.argument && node.init.argument.type || node.argument && node.argument.type

            return type === 'Literal' || type === 'UnaryExpression' && argType === 'Literal'
        }

        function isBinaryExpression(node) {
            return getProp(node, 'type') === 'BinaryExpression'
        }

        function isFunction(node) {
            const type = getProp(node, 'type')

            return type === 'FunctionExpression'
        }

        function isArrayWithValues(node) {
            const type = getProp(node, 'type')
            return type === 'ArrayExpression' && node.init.elements && node.init.elements.length
        }

        function isConstObject(node) {
            const type = getProp(node, 'type')
            const properties = getProp(node, 'properties')

            return type === 'ObjectExpression' &&
                !_.isEmpty(properties) &&
                _.every(_.map(properties, 'value'), value =>
                    isLiteral(value) || isFunction(value) || isDep(value) || isConstObject(value)
                )
        }

        function isReturnedObject(node) {
            let name

            if (node.init.type === 'Identifier' && node.init.name) {
                name = node.init.name
            } else if (node.init.type === 'ObjectExpression') {
                name = node.id && node.id.name
            }

            return _.includes(moduleReturnedVar, name)
        }

        function isFrozen(node) {
            let name

            if (node.init.type === 'Identifier' && node.init.name) {
                name = node.init.name
            } else if (node.init.type === 'ObjectExpression' || node.init.type === 'ArrayExpression' || node.init.type === 'CallExpression') {
                name = node.id && node.id.name
            }

            return _.includes(frozenObjects, name)
        }

        function isRegex(node) {
            return node.init && node.init.type === 'NewExpression' && node.init.callee.name === 'RegExp'
        }

        function isReactCreate(node) {
            const type = getProp(node, 'type')

            if (!(type === 'CallExpression' || node.init)) {
                return false
            }

            const callee = node.init.callee

            return callee &&
                callee.object &&
                callee.object.name &&
                callee.object.name.toLowerCase() === 'react' &&
                callee.property &&
                (callee.property.name === 'createClass' || callee.property.name === 'createFactory')
        }

        function isSantaType(node) {
            const type = getProp(node, 'type')

            if (!(type === 'CallExpression' || node.init)) {
                return false
            }

            const callee = node.init.callee

            return callee && callee.name === 'applyFetch'
        }

        function getObjectName(node) {
            return node.name || getObjectName(node.object)
        }

        function getProp(node, propName) {
            return node.init && node.init[propName] || node[propName]
        }

        /**
         * Extracts the module definition
         * @param {Node} node - A node to check.
         * @returns {Node}
         */
        function getModuleDefinition(node) {
            const defineCall = node.body[0].expression

            return _(defineCall.arguments)
                .filter(namedTypes.FunctionExpression.check)
                .map('body')
                .head()
        }

        function getModuleDependencies(node) {
            const defineCall = node.body[0].expression

            return _(defineCall.arguments)
                .filter(namedTypes.FunctionExpression.check)
                .flatMap('params')
                .map('name')
                .value()
        }

        function getModuleReturnStatement(node) {
            const defineCall = node.body[0].expression
            const definitionBody = _.find(defineCall.arguments, namedTypes.FunctionExpression.check).body.body
            const returnNode = _.find(definitionBody, namedTypes.ReturnStatement.check)

            return returnNode && returnNode.argument && returnNode.argument.name
        }

        function getFrozenObjects(node) {
            const defineCall = node.body[0].expression
            const definitionBody = _.find(defineCall.arguments, namedTypes.FunctionExpression.check).body.body
            return _.filter(definitionBody, statement => {
                return (statement.type === 'ExpressionStatement' && isCallToFreeze(statement.expression)) ||
                    (statement.type === 'VariableDeclaration' && isCallToFreeze(statement.declarations[0].init))

            })
                .map(statement => _.get(statement.expression, 'arguments[0].name') || _.get(statement, 'declarations[0].id.name'))
        }

        function isCallToFreeze(expr) {
            return expr.type === 'CallExpression' &&
                expr.callee.object &&
                expr.callee.property.name === 'freeze'
        }

        return {
            Program(node) {
                if (!isAmdModule(node)) {
                    return
                }

                const moduleDefinition = getModuleDefinition(node)
                moduleDependencies = getModuleDependencies(node)
                moduleReturnedVar = getModuleReturnStatement(node)
                frozenObjects = getFrozenObjects(node)

                const allGlobalVars = getAllGlobalVars(moduleDefinition)

                const stateVars = filterAllowed(allGlobalVars)

                _.forEach(stateVars, report)
            }
        }
    }
}
