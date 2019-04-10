import React from "react";
import ReactDOM from "react-dom";

import { ImageLoader } from "./image_loader.js";
import { EditSequence } from "./edit_seq.js";
import { FullEditView } from "./full_edit.js";

// Main driver. Handles showing the instructions, and then kicking off the task sequence,
// and then sending the results back to the server.
export let editTask = function(taskId, imageIds, categories) {
  let onFinish = function() {};
  let params = new URLSearchParams(window.location.search);
  let startId = params.get("startId");
  // Start the TaskSequence
  ReactDOM.render(
    <EditSequence
      taskId={taskId}
      imageIds={imageIds}
      taskView={FullEditView}
      categories={categories}
      onFinish={onFinish}
      startId={startId}
    />,
    document.getElementById("app")
  );
};
