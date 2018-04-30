import React from 'react';

/*
 * Load an image, perhaps with a spinner, etc.
 */
export class ImageLoader extends React.Component {

    constructor(props) {
        super(props);

        this.onImageLoaded = this.onImageLoaded.bind(this);
        this.onImageErrored = this.onImageErrored.bind(this);
    }

    onImageLoaded() {
        this.props.onImageLoadSuccess(this.image);
    }

    onImageErrored() {
        this.props.onImageLoadError();
    }

    render() {

        return(
            <div style={{display : 'none'}}>
                <img
                    ref={i => { this.image = i; }}
                    src={this.props.url}
                    onLoad={this.onImageLoaded}
                    onError={this.onImageErrored}
                />
                Loading Image
            </div>
        )

    }
}