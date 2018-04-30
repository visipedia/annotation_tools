import React from 'react';
import ReactDOM from 'react-dom';

import 'bootstrap';

import {KEYS} from '../utils.js';


/**
 * Edit a sequence of images. Unlike task_seq.js, this will load and save data to the server each time,
 * rather than saving state.
 */
export class EditSequence extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            imageIndex : -1,
            fetchingData : true
        };

        this.prevImage = this.prevImage.bind(this);
        this.nextImage = this.nextImage.bind(this);
        this.finish = this.finish.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);

    }

    componentDidMount(){
      document.addEventListener("keydown", this.handleKeyDown);

      if(this.props.imageIds.length > 0){

        let nextImageId = this.props.imageIds[0];

        // Get the data for the next image.
        this.getImageData(nextImageId, (imageData)=>{

          // Render the next image
          this.setState(function(prevState, props){
            return {
              imageIndex : 0,
              image : imageData.image,
              annotations : imageData.annotations,
              fetchingData : false
            }
          });
        }, ()=>{
          alert("Failed to load image data");
        });
      }
      this.setState({
        fetchingData : true
      });
    }

    componentWillUnmount(){
      document.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown(e){

      switch(e.keyCode){
        case KEYS.SPACE:
          this.nextImage();
          break;
        case KEYS.LEFT_ARROW:
          this.prevImage();
          break;
        case KEYS.RIGHT_ARROW:
          this.nextImage();
          break
      }

    }

    getImageData(imageId, onSuccess, onFail){

      let endpoint = "/edit_image/" + imageId;

      $.ajax({
        url : endpoint,
        method : 'GET'
      }).done(function(data){
        onSuccess(data);
      }).fail(function(jqXHR, textStatus, errorThrown ){
        console.log(textStatus);
        onFail();
      });

    }


    prevImage(){

      if(this.state.fetchingData){
        return;
      }

      if(this.state.imageIndex == 0){
        return;
      }
      else{
        // Get the next image id
        let nextImageId = this.props.imageIds[this.state.imageIndex - 1];

        // Save the annotations from the current image
        this.taskViewRef.performSave(()=>{

          // Get the data for the next image.
          this.getImageData(nextImageId, (imageData)=>{

            // Render the next image
            this.setState(function(prevState, props){
              return {
                imageIndex : prevState.imageIndex - 1,
                image : imageData.image,
                annotations : imageData.annotations,
                fetchingData : false
              }
            });
          }, ()=>{
            alert("Failed to load image data");
          });
        }, ()=>{
          alert("Failed to save image data");
        });

        this.setState({
          fetchingData : true
        });
      }

    }

    nextImage(){

      if(this.state.fetchingData){
        return;
      }

      if(this.state.imageIndex == this.props.imageIds.length - 1){
        return;
      }
      else{

        // Get the next image id
        let nextImageId = this.props.imageIds[this.state.imageIndex + 1];

        // Save the annotations from the current image
        this.taskViewRef.performSave(()=>{

          // Get the data for the next image.
          this.getImageData(nextImageId, (imageData)=>{

            // Render the next image
            this.setState(function(prevState, props){
              return {
                imageIndex : prevState.imageIndex + 1,
                image : imageData.image,
                annotations : imageData.annotations,
                fetchingData : false
              }
            });
          }, ()=>{
            alert("Failed to load image data");
          });
        }, ()=>{
          alert("Failed to save image data");
        });

        this.setState({
          fetchingData : true
        });
      }

    }

    finish(){

      this.props.onFinish();

    }

    render() {

      if(this.state.fetchingData){
        return (
          <div> Loading Image </div>
        );
      }

      // feedback for the user
      let current_image = this.state.imageIndex + 1;
      let num_images = this.props.imageIds.length;

      // Determine which buttons we should render
      var buttons = []
      if(this.state.imageIndex > 0){
        buttons.push(
          (<button key="prevButton" type="button" className="btn btn-outline-secondary" onClick={this.prevImage}>Prev</button>)
        );
      }
      if(this.state.imageIndex < num_images - 1){
        buttons.push(
          (<button key="nextButton" type="button" className="btn btn-outline-secondary" onClick={this.nextImage}>Next</button>)
        );
      }
      if(this.state.imageIndex == num_images - 1){
        buttons.push(
          (<button key="finishButton" type="button" className="btn btn-outline-success" onClick={this.finish}>Finish</button>)
        );
      }

      return (
        <div>
          <div className="row">
            <div className="col">
              <this.props.taskView ref={ e => { this.taskViewRef = e; }}
                              image={this.state.image}
                              annotations={this.state.annotations}
                              categories={this.props.categories}
                              key={this.state.imageIndex}
                              />
            </div>
          </div>

          <nav className="navbar fixed-bottom navbar-light bg-light">
            <div className="ml-auto">
                <div className="btn-group" role="group">
                  {buttons}
                </div>
                  <span> Image {current_image} / {num_images} </span>
            </div>
            <div className="ml-auto">

            </div>
          </nav>
        </div>
      )
    }

}

EditSequence.defaultProps = {
  imageIds : [], // Array of image ids
  onFinish : null, // a function to call when the image sequence is finished.
  categories : null // Categories array,
};