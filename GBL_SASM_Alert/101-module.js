const { name } = require("mustache");

module.exports = function (RED) {
  let MappingNodes = {};
  /**
   * Initialize the mapping functionality.
   *
   * This function initializes a mapping feature in a Node-RED flow. It sets up a global MappingNodes object that allows for getting and setting properties within the mapping.
   * If a store object is provided, it is used to initialize MappingNodes. Otherwise, a new MappingNodes object is created in the global context.
   *
   * @param {Object} store - Optional. An object containing initial mapping data.
   */
  function initMapping(store) {
    // If initMapping has already been run, do nothing.
    if (initMapping.isruned) return;

    if (store) {
      MappingNodes = store;
    } else {
      MappingNodes = {
        get(name) {
          return RED.util.getObjectProperty(MappingNodes, name);
        },
        set(name, arg) {
          RED.util.setObjectProperty(MappingNodes, name, arg, true);
        }
      };
    }

    RED.events.on("flows:started", Mapping);

    initMapping.isruned = true;
  }

  /**
   * Perform mapping when the flow starts.
   *
   * This function is executed every time the Node-RED flow starts. It collects metadata and instances of various node types, such as moduleflows, module_in, and module_out nodes. It also identifies workspaces and subflows within the flow.
   *
   */
  function Mapping() {
    const moduleflowNode = {};
    const moduleinNode = {};
    const moduleoutNode = {};
    const submoduleNode = {};
    const myNodeinFlow = {};

    const namekeyNode = {};

    const allNode = {};
    const workspaces = {};
    const subflows = {};

    // Iterate through all nodes in the flow.
    RED.nodes.eachNode(node => {
      allNode[node.id] = Object.assign({}, node);
      if (node.type === "tab") {
        workspaces[node.id] = node;
      } else if (node.type === "subflow") {
        subflows[node.id] = node;
      } else if (node.type === "moduleflows") {
        moduleflowNode[node.id] = node;
      } else if (node.type === "module_in") {
        moduleinNode[node.id] = node;
        if (typeof namekeyNode[node.name] === "undefined")
          namekeyNode[node.name] = [];
        namekeyNode[node.name].push(node.id);
      } else if (node.type === "module_out") {
        moduleoutNode[node.id] = node;
      } else if (node.type == "submodule") {
        submoduleNode[node.id] = node;
      } else if (node.type.startsWith("subflow:")) {
      }
    });

    for (const nodename in namekeyNode) {
      if (namekeyNode[nodename].length != 1) {
        console.log(nodename);
        namekeyNode[nodename].forEach(nodeID => {
          RED.events.emit("GBLtext:" + nodeID, {
            fill: "red",
            shape: "dot",
            text: `name "${nodename}" is duplication`
          });
        });
      }
    }

    Object.assign(myNodeinFlow, {
      ...moduleflowNode,
      ...moduleinNode,
      ...moduleoutNode,
      ...submoduleNode
    });

    MappingNodes.set("myModuleflows", myNodeinFlow);
  }

  RED.nodes.registerType("moduleflows", moduleflows);
  function moduleflows(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    initMapping(node.context().global);

    var event = "GBLmodule:" + node.id;
    var event_fun = function (msg) {
      node.send(msg);
    };
    RED.events.on(event, event_fun);

    this.on("close", function () {
      RED.events.removeListener(event, event_fun);
      this.status({});
    });

    this.on("input", function (msg) {
      if (config.moduleId === null) {
        this.status({
          fill: "red",
          shape: "dot",
          text: "target missed"
        });
        return;
      } else if (
        MappingNodes.get("myModuleflows")[config.moduleId].type != "module_in"
      ) {
        this.status({
          fill: "red",
          shape: "dot",
          text: "target error"
        });
        return;
      } else if (
        config.submoduleId != null &&
        MappingNodes.get("myModuleflows")[config.submoduleId].type !=
          "submodule"
      ) {
        this.status({
          fill: "red",
          shape: "dot",
          text: "target error"
        });
        return;
      }
      // To return to this node, stack is used.
      if (typeof msg.__GBLstack == "undefined") {
        msg.__GBLstack = [];
      }

      msg.__GBLstack.push(event);

      //start linked module in
      if (config.submoduleId === null) {
        RED.events.emit("GBLmodule:" + config.moduleId, msg);
      } else RED.events.emit("GBLmodule:" + config.submoduleId, msg);
    });
  }
  RED.nodes.registerType("module_in", module_in);
  function module_in(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    initMapping(node.context().global);

    var event = "GBLmodule:" + node.id;
    var event_fun = function (msg) {
      node.receive(msg);
    };
    RED.events.on(event, event_fun);

    var node_test_event = "GBLtext:" + node.id;
    var node_test_event_fun = function (status) {
      console.log(node.id + " 왜 안되냐....");
      console.log(status);
      node.status(status);
    };
    RED.events.on(node_test_event, node_test_event_fun);

    this.on("close", function () {
      RED.events.removeListener(event, event_fun);
      RED.events.removeListener(node_test_event, node_test_event_fun);
      // node.status({});
    });

    this.on("input", function (msg) {
      node.send(msg);
    });
  }

  RED.nodes.registerType("module_out", module_out);
  function module_out(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    initMapping(node.context().global);

    this.on("input", function (msg) {
      if (typeof msg.__GBLstack != "undefined") {
        RED.events.emit(msg.__GBLstack.pop(), msg);
      }
    });
  }
};
