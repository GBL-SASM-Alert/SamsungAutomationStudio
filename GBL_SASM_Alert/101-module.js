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
      } else if (node.type === "GBL_module_in") {
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

    // 정석 체크
    for (const nodename in namekeyNode) {
      if (namekeyNode[nodename].length != 1) {
        namekeyNode[nodename].forEach(nodeID => {
          RED.events.emit("GBLtext:" + nodeID, {
            fill: "red",
            shape: "dot",
            text: "error"
          });
        });
      } else {
        RED.events.emit("GBLtext:" + namekeyNode[nodename][0], {});
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
      node.status({});
    });

    const target_error = function () {
      node.status({
        fill: "red",
        shape: "dot",
        text: "target missed"
      });
    };

    this.on("input", function (msg) {
      const mynodes = MappingNodes.get("myModuleflows");
      if (config.moduleId === null) {
        target_error();
        return;
      } else if (
        typeof mynodes[config.moduleId] === "undefined" ||
        mynodes[config.moduleId].type != "module_in"
      ) {
        target_error();
        return;
      } else if (
        config.submoduleId != null &&
        (typeof mynodes[config.submoduleId] === "undefined" ||
          mynodes[config.submoduleId].type != "submodule")
      ) {
        target_error();
        return;
      }

      // To return to this node, stack is used.
      if (typeof msg.__GBLstack == "undefined") {
        msg.__GBLstack = [];
      }

      msg.__GBLstack.push(event);

      //start linked module in
      if (config.submoduleId === null) {
        if (typeof mynodes[config.moduleId] === "undefind") {
          target_error();
          return;
        }

        RED.events.emit("GBLmodule:" + config.moduleId, msg);
      } else {
        if (typeof mynodes[config.submoduleId] === "undefind") {
          target_error();
          return;
        }
        RED.events.emit("GBLmodule:" + config.submoduleId, msg);
      }
    });
  }
  RED.nodes.registerType("GBL_module_in", module_in);
  function module_in(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    initMapping(node.context().global);

    var event = "GBLmodule:" + node.id;
    var event_fun = function (msg) {
      node.receive(msg);
    };
    RED.events.on(event, event_fun);

    var node_text_event = "GBLtext:" + node.id;
    var node_text_event_fun = function (status) {
      node.status(status);
    };
    RED.events.on(node_text_event, node_text_event_fun);

    this.on("close", function () {
      RED.events.removeListener(event, event_fun);
      RED.events.removeListener(node_text_event, node_text_event_fun);
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
