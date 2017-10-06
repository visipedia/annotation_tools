/**
 * MTurk wrapper for annotation tasks.
 *
 * This won't submit the data if assignmentId=ASSIGNMENT_ID_NOT_AVAILABLE
 *
 */

import $ from 'jquery';

function parseParameters(url){
  var params = {
    'assignmentId' : null,
    'hitId' : null,
    'workerId' : null,
    'turkSubmitTo' : null
  };

  var queryString = url.split('?')[1];

  if (queryString){
    var queryPieces = queryString.split('&');
    for (var i = 0; i < queryPieces.length; ++i){
      pieces = queryPieces[i].split('=');
      paramName = pieces[0];
      paramValue = pieces[1];
      if(paramName in params){
        params[paramName] = paramValue;
      }
    }
  }

  return params;
}

var MTurkFinishWrapper = function(submitFunc){

  var wrappedFunc = function(){

    let url = window.location.href;
    let mturkParams = parseParameters(url);

    var goodToSubmit = true;
    if (mturkParams['assignmentId'] == null || mturkParams['assignmentId'] == 'ASSIGNMENT_ID_NOT_AVAILABLE'){
      goodToSubmit = false;
    }
    if (mturkParams['hitId'] == null){
      goodToSubmit = false;
    }
    if (mturkParams['workerId'] == null){
      goodToSubmit = false;
    }
    if (mturkParams['turkSubmitTo'] == null){
      goodToSubmit = false;
    }

    if (goodToSubmit){

      taskResults['assignment_id'] = mturkParams['assignmentId'];
      taskResults['hit_id'] = mturkParams['hitId'];
      taskResults['worker_id'] = mturkParams['workerId'];

      // Store the results on the server
      submitFunc(arguments[0], ()=>{

        // Create a form and post it back to AWS
        let postURL = mturkParams['turkSubmitTo'] + 'mturk/externalSubmit';

        $(`<form action="${postURL}" method="post">
          <input type="hidden" name="assignmentId" id="assignmentId" value="${mturkParams['assignmentId']}">
          </form>`
        ).appendTo('body').submit();

      }, ()=>{
        // Should we post back to AWS even in a failure?
      });

    }
    else{
      console.log("Not submitting results, bad mturk parameters.");
    }
  }

  return wrappedFunc;
}

export {MTurkFinishWrapper};