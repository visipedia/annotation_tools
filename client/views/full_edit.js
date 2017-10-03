
import React from 'react';

import $ from 'jquery';

import {ImageLoader} from './image_loader.js';
import {LeafletAnnotation} from './leaflet_annotation.js';

export class FullEditView extends React.Component {

  constructor(props) {
        super(props);

        this.state = {
            imageElement : null
        };

        this.handleImageLoaded = this.handleImageLoaded.bind(this);
        this.handleImageFailed = this.handleImageFailed.bind(this);
        this.saveAnnotations = this.saveAnnotations.bind(this);
    }

    handleImageLoaded(imageElement) {
        this.setState({
            imageElement: imageElement
        });
    }

    handleImageFailed(){
        console.log('Image failed to load');
    }

    performSave(){
      if(this.leafletImage != 'undefined' && this.leafletImage != null){
        this.leafletImage.handleSave();
      }
    }

    saveAnnotations(annotations){
      console.log("saving annotations");
      $.ajax({
        url : "/annotations/save",
        method : 'POST',
        data : JSON.stringify({'annotations' : annotations}),
        contentType: 'application/json'
      }).done(function(){
        console.log("saved annotations");
      }).fail(function(){

      });
    }

  render() {

    if (this.state.imageElement == null){
        return (
            <ImageLoader url={this.props.image.url}
                onImageLoadSuccess={this.handleImageLoaded}
                onImageLoadError={this.handleImageFailed} />
        )
    }
    else{
      return (
        <div>
          <div className="row">
            <div className="col">
              <LeafletAnnotation ref={m => { this.leafletImage = m; }}
                            imageElement={this.state.imageElement}
                            image={this.props.image}
                            annotations={this.props.annotations}
                            categories={this.props.categories}
                            enableEditing={true}
                            onSave={this.saveAnnotations}/>
            </div>
          </div>
        </div>
      );
    }
  }

}