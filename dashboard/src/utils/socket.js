import { io } from "socket.io-client";
import { setInitState } from "./store";

const { FRONT_SOCKET_TYPE } = require("../../common/common");

let socket;

export const initlaizeSocket = (dispatch) => {
  socket = io();

  socket.on("connect", () => {
    console.info(`socket connected : ${socket.id}`);
  });

  socket.on(FRONT_SOCKET_TYPE.INIT_STATES, (states) => {
    dispatch(setInitState(states));
  });

  socket.on(FRONT_SOCKET_TYPE.UPDATE_STATE, (states) => {
    console.log(states);
  });
};

export const disconnectSocket = () => {
  socket.disconnect();
};

export const sendMessage = (nodeId, messageBody) => {
  socket.emit(FRONT_SOCKET_TYPE.RECEIVE_MESSAGE, {
    nodeId: nodeId,
    ...messageBody,
  });
};
