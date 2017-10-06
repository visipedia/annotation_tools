/**
 * Generic task instructions:
 * <title>
 * <decription>
 * <link to google slides with more instructions>
 * <carousel of example photos>
 * <start button>
 */

import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap';

export class TaskInstructions extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
        imageElement : null
    };

    this.handleStart = this.handleStart.bind(this);

  }

  handleStart(){
    this.props.onStart()
  }

  render(){

    var examplePhotosEl;
    if (this.props.examples.length){
      // Create a carousel for the example photos
      let carouselId = "taskInstructionCarousel";
      var li_els = [];
      var div_els = [];
      for( var i=0; i < this.props.examples.length; ++i){
        if (i == 0){
          li_els.push(<li key={i} data-target={"#" + carouselId} data-slide-to={i} className="active"></li>);
          div_els.push(<div key={i} className="carousel-item active"><img className="d-block mx-auto task-instructions-carousel-img" src={this.props.examples[i]} alt="example"/></div>);
        }
        else{
          li_els.push(<li key={i} data-target={"#" + carouselId} data-slide-to={i}></li>);
          div_els.push(<div key={i} className="carousel-item"><img className="d-block mx-auto task-instructions-carousel-img" src={this.props.examples[i]} alt="example"/></div>);
        }
      }

      examplePhotosEl = (
        <div id={carouselId} className="carousel slide" data-ride="carousel" data-interval="2000">
          <ol className="carousel-indicators">
            {li_els}
          </ol>
          <div className="carousel-inner">
            {div_els}
          </div>
          <a className="carousel-control-prev" href={"#" + carouselId} role="button" data-slide="prev">
            <span className="carousel-control-prev-icon" aria-hidden="true"></span>
            <span className="sr-only">Previous</span>
          </a>
          <a className="carousel-control-next" href={"#" + carouselId} role="button" data-slide="next">
            <span className="carousel-control-next-icon" aria-hidden="true"></span>
            <span className="sr-only">Next</span>
          </a>
        </div>
      );
    }
    else{
      examplePhotosEl = <div></div>;
    }

    return (
      <div>
        <div className="row">
          <div className="col">
            <h2> {this.props.title}</h2>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <p> {this.props.description}</p>
          </div>
        </div>
        <div className="row">
          <div className="col">
            <span>Detailed instructions can be found <a href={this.props.instructions} target="_blank">here</a>.</span>
          </div>
        </div>
        <div className="row">
          <div className="col-lg-8 ml-auto mr-auto">
            {examplePhotosEl}
          </div>
        </div>
        <div className="row">
          <div className="col">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={this.handleStart}>Start</button>
          </div>
        </div>
      </div>
    )
  }

}
TaskInstructions.defaultProps = {
  title : "Draw Boxes",
  description : "Draw boxes on images.",
  instructions : "https://docs.google.com/presentation/d/1v1VWW6KZ74BCkB4lXn3u4THLrMqp7dAc08iMxlVZ0Zw/edit?usp=sharing",
  examples: []
}