/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator 1.7.0 from webgme on Wed Mar 08 2017 15:24:49 GMT-0600 (Central Standard Time).
 * A plugin that inherits from the PluginBase. To see source code documentation about available
 * properties and methods visit %host%/docs/source/PluginBase.html.
 */

define([
    'plugin/PluginConfig',
    'text!./metadata.json',
    'plugin/PluginBase',
    'common/util/ejs',
    'text!./Templates/componentType.ejs',
    'plugin/BehaviorSpecGenerator/BehaviorSpecGenerator/GuardExpressionParser'
], function (
    PluginConfig,
    pluginMetadata,
    PluginBase,
    ejs,
    componentTypeTemplate,
    GuardExpressionParser) {
    'use strict';

    pluginMetadata = JSON.parse(pluginMetadata);

    /**
     * Initializes a new instance of ComponentTypeGenerator.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin ComponentTypeGenerator.
     * @constructor
     */
    var BehaviorSpecGenerator = function () {
        // Call base class' constructor.
        PluginBase.call(this);
        this.pluginMetadata = pluginMetadata;
    };

    /**
     * Metadata associated with the plugin. Contains id, name, version, description, icon, configStructue etc.
     * This is also available at the instance at this.pluginMetadata.
     * @type {object}
     */
    BehaviorSpecGenerator.metadata = pluginMetadata;

    // Prototypical inheritance from PluginBase.
    BehaviorSpecGenerator.prototype = Object.create(PluginBase.prototype);
    BehaviorSpecGenerator.prototype.constructor = BehaviorSpecGenerator;

    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    BehaviorSpecGenerator.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            artifact;


        // Using the logger.
        self.logger.debug('This is a debug message.');

        self.extractDataModel(self.activeNode)
            .then(function (nodes) {
                var violations = self.hasViolations(nodes),
                    componentInfos,
                    dataModelStr;

                if (violations.length > 0) {
                    violations.forEach(function (violation) {
                        self.createMessage(violation.node, violation.message, 'error');
                    });
                    throw new Error('Model has ' + violations.length + '  violation(s), see messages for details..');
                }

                componentInfos = self.makeModelObject(nodes);
                dataModelStr = JSON.stringify(componentInfos, null, 4);
                self.componentInfos = componentInfos;
                //self.logger.info('************DataModel***********\n', dataModelStr);

                var filesToAdd = {};

                for (var i = 0; i<componentInfos.length; i++) {
                    var fileName = componentInfos[i].name + '.java';
                    filesToAdd[fileName] = ejs.render(componentTypeTemplate, componentInfos[i]);
                    //self.logger.info('************LangModel***********\n', filesToAdd[fileName]);
                }

                artifact = self.blobClient.createArtifact('BehaviorSpecifications');

                return artifact.addFiles(filesToAdd);
            })
            .then(function (fileHash) {
                self.result.addArtifact(fileHash);
                return artifact.save();
            })
            .then(function (artifactHash) {
                self.result.addArtifact(artifactHash);
                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch(function (err) {
                self.logger.error(err.stack);
                // Result success is false at invocation.
                callback(err, self.result);
            }) ;
    };

    BehaviorSpecGenerator.prototype.extractDataModel = function (node) {
        var self = this;
        return self.core.loadSubTree(node)
            .then(function (nodeArr) {
                var nodes = {},
                    i;
                for (i = 0; i < nodeArr.length; i += 1) {
                    nodes[self.core.getPath(nodeArr[i])] = nodeArr[i];
                }
                return nodes;
            });
    };

    BehaviorSpecGenerator.prototype.makeModelObject = function (nodes) {
        var self = this,
            path,
            node,
            componentTypes = [];

        for (path in nodes) {
            node = nodes[path];

            if (self.isMetaTypeOf(node, self.META.ComponentType)) {
                componentTypes.push(self.getComponentData(node, nodes));
            }
        }
        return componentTypes;
    };

    BehaviorSpecGenerator.prototype.getComponentData = function (ctNode, nodes) {
        var info = {
            name: this.core.getAttribute(ctNode, 'name'),
            path: this.core.getPath(ctNode),
            cardinality: this.core.getAttribute(ctNode, 'cardinality'),
            definitions: this.core.getAttribute(ctNode, 'definitions'),
            forwards: this.core.getAttribute(ctNode, 'forwards'),
            constructors: this.core.getAttribute(ctNode, 'constructors'),
            transitions: [],
            states: [],
            guards: []
        },
            childrenPaths = this.core.getChildrenPaths(ctNode),
            childNode,
            i;
        //todo populate the

        for (i = 0; i<childrenPaths.length; i++) {
            childNode = nodes[childrenPaths[i]];
            if (this.isMetaTypeOf(childNode, this.META.TransitionBase)) {
                info.transitions.push(this.getTransitionInfo(childNode, nodes));
            } else if (this.isMetaTypeOf(childNode, this.META.StateBase)) {
                info.states.push(this.getStateInfo(childNode, nodes));
            } else if (this.isMetaTypeOf(childNode, this.META.Guard)) {
                info.guards.push(this.getGuardInfo(childNode, nodes));
            }
        }
        return info;
    };

    BehaviorSpecGenerator.prototype.getGuardInfo = function (node/*, nodes*/) {
        var info = {
            name: this.core.getAttribute(node, 'name'),
            type: this.core.getAttribute(this.core.getMetaType(node), 'name'),
            path: this.core.getPath(node),
            guardMethod: this.core.getAttribute(node, 'guardMethod')
        };
        return info;
    };

    BehaviorSpecGenerator.prototype.getTransitionInfo = function (node, nodes) {
        var info = {
                name: this.core.getAttribute(node, 'name'),
                type: this.core.getAttribute(this.core.getMetaType(node), 'name'),
                path: this.core.getPath(node),
                src: '',
                dst: '',
                guard: this.core.getAttribute(node, 'guardName'),
                transitionMethod: this.core.getAttribute(node, 'transitionMethod')
            };
        var srcNode;
        var dstNode;

        var srcPath = this.core.getPointerPath(node, 'src');
        //this.logger.info('************srcPath***********\n',srcPath);
        var dstPath = this.core.getPointerPath(node, 'dst');
        //this.logger.info('************dstPath***********\n',dstPath);

        if (srcPath) {
            srcNode = nodes[srcPath];
            info.src = this.core.getAttribute(srcNode, 'name');
            //this.logger.info('************srcNode Name***********\n',info.src);
        }

        if (dstPath) {
            dstNode = nodes[dstPath];
            info.dst = this.core.getAttribute(dstNode, 'name');
            //this.logger.info('************dstNode Name***********\n',info.dst);
        }

        return info;

    };

    BehaviorSpecGenerator.prototype.getStateInfo = function (node/*,nodes*/) {
        var info = {
            name: this.core.getAttribute(node, 'name'),
            type: this.core.getAttribute(this.core.getMetaType(node), 'name'),
            path: this.core.getPath(node)
        };

        return info;
    };

    BehaviorSpecGenerator.prototype.hasViolations = function (nodes) {
        var violations = [],
            componentTypeNames = {},
            name,
            nodePath,
            node;

        for (nodePath in nodes) {
            var stateNames = {};
            node = nodes[nodePath];
            name = this.core.getAttribute(node, 'name');
            // TODO: check all expected types and more constraints.
            if (this.isMetaTypeOf(node, this.META.ComponentType)) {
                // This will be a java class - no special characters etc.
                // The example is incomplete and also allows leading numbers, try at https://regex101.com/
                //if (/^[0-9a-zA-Z_]+$/.test(name) === false) {
                if (/^(?!abstract|continue|for|new|switch|assert|default|goto|package|synchronized|boolean|do|if|private|this|break|double|implements|protected|throw|byte|else|import|public|throws|case|enum|intanceof|return|transient|catch|extends|int|short|try|char|final|interface|static|void|class|finally|long|strictfp|volatile|const|float|native|super|while|Abstract|Continue|For|New|Switch|Assert|Default|Goto|Package|Synchronized|Boolean|Do|If|Private|This|Break|Double|Implements|Protected|Throw|Byte|Else|Import|Public|Throws|Case|Enum|Intanceof|Return|Transient|Catch|Extends|Int|Short|Try|Char|Final|Interface|Static|Void|Class|Finally|Long|Strictfp|Volatile|Const|Float|Native|Super|While)[A-Z][0-9a-z]+$/.test(name) === false) {
                    violations.push({
                        node: node,
                        message: 'Illegal ComponentType name [' + name + '] \nIt is an illegal java class name.'
                    });
                    this.logger.info('Improper Java class name');
                }

                if (componentTypeNames.hasOwnProperty(name)) {
                    violations.push({
                        node: node,
                        message: 'Duplicated name [' + name + '] shared with ' + componentTypeNames[name]
                    });
                }
                componentTypeNames[name] = this.core.getPath(node);


                // check for states,guards and transitions in each componentType

                //var childrenPaths = this.core.getChildrenPaths(node);
                //this.logger.info("*******",childrenPaths);

                for (var childPath of this.core.getChildrenPaths(node))
                {
                    this.logger.info("*******",childPath);
                    var child  = nodes[childPath];
                    //this.logger.info("*******",child);
                    //this.logger.info("*******",child);
                    var childName = this.core.getAttribute(child,'name');

                    if ((this.isMetaTypeOf(child, this.META.State)) || (this.isMetaTypeOf(child, this.META.InitialState))) {
                        if (stateNames.hasOwnProperty(childName)) {
                            violations.push({
                                node: node,
                                message: 'Duplicated name [' + childName + '] shared with ' + stateNames[childName]
                            });
                        }
                        stateNames[childName] = this.core.getPath(child);
                        this.logger.info("*******",stateNames[childPath]);
                    }

                }
            }
        }

        return violations;
    };

    return BehaviorSpecGenerator;
});
