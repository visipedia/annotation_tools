import React from "react";

/**
 * This renders the name of a keypoint and its current visibility setting.
 */
export class KeypointInfo extends React.Component {
  constructor(props) {
    super(props);

    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  onVisibilityChange(visibility) {
    this.props.visibilityChanged(this.props.id, visibility);
  }

  render() {
    let radio_name = this.props.name + " vis_anno_" + this.props.annotation_id;

    return (
      <tr>
        <th scope="row">
          <span className="badge" style={{ backgroundColor: this.props.color }}>
            &#9675;
          </span>{" "}
          {this.props.name}
        </th>
        <td>
          <input
            type="radio"
            aria-label="n/a"
            value="0"
            name={radio_name}
            checked={this.props.visibility == 0}
            autoFocus={this.props.visibility == 0}
            onChange={e => this.onVisibilityChange(0)}
          />
        </td>
        <td>
          <input
            type="radio"
            aria-label="occluded"
            value="1"
            name={radio_name}
            checked={this.props.visibility == 1}
            onChange={e => this.onVisibilityChange(1)}
          />
        </td>
        <td>
          <input
            type="radio"
            aria-label="visible"
            value="2"
            name={radio_name}
            checked={this.props.visibility == 2}
            onChange={e => this.onVisibilityChange(2)}
          />
        </td>
      </tr>
    );
  }
}
