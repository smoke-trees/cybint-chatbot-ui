import { useContext, useEffect, useState, createContext } from "react";
import StateRequests from "../utils/StateRequests";
import TransitionRequests from "../utils/TransitionRequests";

const StateTransContext = createContext();

export function useStateTrans() {
  return useContext(StateTransContext);
}
const emptyTransition = {
  statement: "",
  keywords: [],
  end: "",
  spareContent: "",
  intent: "",
  state: "",
  type: "",
};

export function StateTransProvider({ children }) {
  const [rootStateId, setRootStateId] = useState("602b6749f6d42f1f4cc61533"); // the state at the root of the graph
  const [stateTransData, setStateTransData] = useState([]); // the whole data
  const [isLoading, setIsLoading] = useState(false);
  const [refresh, setRefresh] = useState({});

  // Function to get index + of the state by ID
  // Returns -1 if not found
  function getStateNum(id) {
    const i = stateTransData.findIndex((st) => st._id === id);
    return i >= 0 ? i + 1 : i;
  }
  function getStateById(id) {
    const i = getStateNum(id) - 1;
    if (i >= 0) {
      return stateTransData[i];
    }
  }
  // Function to replace a transition in a state by STATE ID and TRANS Object if trans id found else return false
  const updateTransInState = async (state_id, trans, transIndex) => {
    if (stateTransData) {
      const stateIndex = getStateNum(state_id) - 1;
      if (stateIndex < 0) {
        console.log(`State ${state_id} Not Found`);
        return { success: false };
      }
      // shalow copy all props of state
      let newState = { ...stateTransData[stateIndex] };
      // copy each of thre transitions into the new state
      if (!newState.transitions) {
        return { success: false };
      }
      newState.transitions = newState.transitions.map((t) => ({ ...t }));
      // check if it's not found
      if (transIndex < 0 || transIndex > newState.transitions.length) {
        return { success: false, stateIndex };
      }

      // replace the old trans with new trans
      newState.transitions[transIndex] = trans;

      // repalce the newly modified state
      const newStateTransData = { ...stateTransData };
      newStateTransData[stateIndex] = newState;
      // update in backend
      const data = await TransitionRequests.update(trans._id, newState);
      if (data) {
        setStateTransData(newStateTransData);
        return { success: true, stateIndex, transIndex };
      }
      return { success: false };
    }
  };
  //Function to append a new transition to a state if it doesn't already exist
  const addTransInState = async (state_id, t = emptyTransition) => {
    const stateIndex = getStateNum(state_id) - 1;
    if (stateIndex >= 0) {
      const newState = { ...stateTransData[stateIndex] };
      if (!newState.transitions) {
        console.error("Transitions Missing");
        return;
      }
      const result = await TransitionRequests.create(state_id, t);
      if (result) {
        // find index of the required trans
        // if not found, push
        newState.transitions.push(t);
        // shalow copy current data
        const newStateTransData = { ...stateTransData };
        // replace the state
        newStateTransData[stateIndex] = newState;
        setStateTransData(newStateTransData);
      }
    }
  };

  // function to add a state
  const addState = async () => {
    const state = await StateRequests.create();
    if (state) {
      const i = getStateNum(state._id) - 1;
      if (i < 0) {
        const newStateTransData = { ...stateTransData };
        newStateTransData.push(state);
        setStateTransData(newStateTransData);
      }
    }
  };
  // Function to traverse the graph over the network
  const traverseCurrGraph = async () => {
    console.log(
      `traversing the graph, host: ${process.env.REACT_APP_ROOT_URL}`
    );
    setIsLoading(true);
    const temp = [];
    if (rootStateId) {
      const currState = await StateRequests.fetchById(rootStateId);
      console.log(currState);
      if (currState) {
        temp.push(currState);
      }
      console.log(temp);
      // loop through the array
      for (let i = 0; i < temp.length; i++) {
        // for each "State" Object
        // map it's transitions array  from array of ids to objects
        // console.log(temp, i);
        for (let j = 0; j < temp[i].transitions.length; j++) {
          const transData = temp[i].transitions[j];
          // try to find state with id same as transData.state
          // if not found, get and push inside the array
          if (
            transData.end &&
            temp.findIndex((s) => s._id === transData.state) === -1
          ) {
            const stateData = await StateRequests.fetchById(transData.state);
            temp.push(stateData);
          }
        }
      }

      setStateTransData(temp);
    }
    setIsLoading(false);
    console.log("traversal complete");
  };
  // Function to trigger retreversal of the graph
  const triggerSTRefresh = () => {
    setRefresh({ r: Math.random() });
  };

  // useEffect to call the graph traversal function on "rootState" change
  useEffect(() => {
    traverseCurrGraph();
  }, [rootStateId, refresh]);
  const val = {
    stateTransData,
    isLoading,
    getStateNum,
    updateTransInState,
    addTransInState,
    traverseCurrGraph,
    triggerSTRefresh,
    addState,
    getStateById,
  };
  return (
    <StateTransContext.Provider value={val}>
      {children}
    </StateTransContext.Provider>
  );
}
