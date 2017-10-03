import React from 'react';

class DefaultEditInstructions extends React.Component {

  render() {
    return (
      <div className="card card-outline-primary">
        <div className="card-block">
          <h4 className="card-title">Free edit</h4>
          <p className="card-text">Edit any annotations that need adjustment. Use the drag handles to modify boxes. Drag the markers to modify points. Use the visibility checkboxes to modify whether a component is visible or not.</p>
          <p className="card-text">Press the `Save` button to save the annotations, or press the `s` key.</p>
        </div>
      </div>
    );
  }
}

class KeypointInstructions extends React.Component {

  render(){
    return (
      <div className="card card-warning">
        <div className="card-block">
          <h4 className="card-title">Click on the <span className="font-italic font-weight-bold">{this.props.name}</span></h4>
          <p className="card-text">Press `v` to toggle the visibility. Press `esc` or change the visibility to n/a to cancel.</p>
          <p className="card-text">Press the `Save` button to save the annotations, or press the `s` key.</p>
        </div>
      </div>
    );
  }

}

class BBoxInstructions extends React.Component {

  render(){
    return (
      <div className="card card-warning">
        <div className="card-block">
          <h4 className="card-title">Click and drag a box around the <span className="font-italic font-weight-bold">{this.props.name}</span></h4>
          <p className="card-text">Press `esc` to cancel.</p>
          <p className="card-text">Press the `Save` button to save the annotations, or press the `s` key.</p>
        </div>
      </div>
    );
  }

}

export { DefaultEditInstructions, KeypointInstructions, BBoxInstructions }