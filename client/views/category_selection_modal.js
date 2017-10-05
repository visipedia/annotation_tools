import React from 'react';

/**
 * This renders a modal for category selection.
 */
export class CategorySelectionModal extends React.Component {

  constructor(props) {
    super(props);

    // want to add an index to the categories
    var data = [];
    for(var i=0; i < this.props.categories.length; i++){
      var cat = Object.assign({}, this.props.categories[i]);
      cat.idx = i;
      data.push(cat);
    }

    this.state = {
      data: data,
      filteredData : data
    };

    this.filterData = this.filterData.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onSelect = this.onSelect.bind(this);
  }

  shown(){
    this.filterInput.focus();
  }

  onCancel(){
    this.props.cancelled();
  }

  onSelect(e){
    let idx = parseInt(e.target.dataset.idx);
    this.props.selected(idx);
  }

  filterData(e){
    e.preventDefault();
    let regex = new RegExp(e.target.value, 'i');
    let filtered = this.state.data.filter((category) => {
      return category.name.search(regex) > -1;
    });
    this.setState({
      filteredData : filtered
    });
  }

  render(){

    let filteredCategories = this.state.filteredData;

    var categoryEls = [];
    for(var i = 0; i < filteredCategories.length; i++){
      let cat = filteredCategories[i];
      categoryEls.push((
        <li key={cat.idx}>
          <button data-idx={cat.idx} type="button" className="btn btn-outline-primary" onClick={this.onSelect}>{cat.name}</button>
        </li>
      ));
    }

    return (
      <div>
        <div className="modal-header">
          <h5 className="modal-title" id="categorySelectionModalLabel">Category Selection</h5>
        </div>
        <div className="modal-body">
          <input ref={(input) => {this.filterInput = input;}} type='text' onChange={this.filterData}></input>
          <ul id="categorySelectionModalCategoryList">{categoryEls}</ul>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={this.onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

}