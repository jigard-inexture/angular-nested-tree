import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, Injectable } from '@angular/core';
import {
  MatTreeFlatDataSource,
  MatTreeFlattener,
} from '@angular/material/tree';
import { BehaviorSubject } from 'rxjs';

/**
 * Node for to-do item
 */
export class TodoItemNode {
  children: TodoItemNode[];
  item: string | '';
  id: number;
  type: 'folder' | 'file' | 'unset' | null;
}

/** Flat to-do item node with expandable and level information */
export class TodoItemFlatNode {
  item: string;
  level: number;
  expandable: boolean;
  id: number;
  type: 'folder' | 'file' | 'unset' | null;
}

/**
 * The Json object for to-do list data.
 */
const TREE_DATA = {
  Groceries: {
    'Almond Meal flour': null,
    'Organic eggs': null,
    'Protein Powder': null,
    Fruits: {
      Apple: null,
      Berries: ['Blueberry', 'Raspberry'],
      Orange: null,
    },
  },
  Reminders: [
    'Cook dinner',
    'Read the Material Design spec',
    'Upgrade Application to Angular',
  ],
};

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
@Injectable()
export class ChecklistDatabase {
  dataChange = new BehaviorSubject<TodoItemNode[]>([]);

  get data(): TodoItemNode[] {
    return this.dataChange.value;
  }

  constructor() {
    this.initialize();
  }

  initialize() {
    // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
    //     file node as children.
    const data = [];

    console.log('data', data);

    // Notify the change.
    this.dataChange.next(data);
  }

  /**
   * Build the file structure tree. The `value` is the Json object, or a sub-tree of a Json object.
   * The return value is the list of `TodoItemNode`.
   */
  buildFileTree(obj: { [key: string]: any }, level: number): TodoItemNode[] {
    return Object.keys(obj).reduce<TodoItemNode[]>((accumulator, key) => {
      const value = obj[key];
      const node = new TodoItemNode();
      node.item = key;

      if (value != null) {
        if (typeof value === 'object') {
          node.children = this.buildFileTree(value, level + 1);
        } else {
          node.item = value;
        }
      }

      return accumulator.concat(node);
    }, []);
  }

  /** Add an item to to-do list */
  insertItem(parent: TodoItemNode, name: string) {
    if (parent.children) {
      parent.children.push({
        children: [],
        item: name,
        id: new Date().valueOf(),
        type: 'file',
      } as TodoItemNode);
      this.dataChange.next(this.data);
    }
  }

  insertFolderItem(parent: TodoItemNode, name: string) {
    if (parent.children) {
      parent.children.push({
        children: [],
        item: name,
        id: new Date().valueOf(),
        type: 'folder',
      });
      this.dataChange.next(this.data);
    }
  }

  /** Add an item to to-do list */
  deleteChildItem(parent: TodoItemNode, name: string) {
    if (parent.children) {
      parent.children = [];
      parent.children.push({ item: name } as TodoItemNode);
      this.dataChange.next(this.data);
    }
  }

  insertRootItem() {
    this.data.push({
      children: [],
      item: '',
      id: new Date().valueOf(),
      type: 'folder',
    });
    this.dataChange.next(this.data);
  }

  updateItem(node: TodoItemNode, name: string) {
    node.item = name;
    this.dataChange.next(this.data);
  }

  deleteItem(node: TodoItemNode, i, isFlateNode, j?: any) {
    if (isFlateNode) {
      this.dataChange.value[j].children.splice(i, 1);
    } else {
      let index = this.data.findIndex((x) => x.id === node.id);
      this.data.splice(index, 1);
    }
    this.dataChange.next(this.data);
  }
}

/**
 * @title Tree with checkboxes
 */
@Component({
  selector: 'tree-checklist-example',
  templateUrl: 'tree-checklist-example.html',
  styleUrls: ['tree-checklist-example.css'],
  providers: [ChecklistDatabase],
})
export class TreeChecklistExample {
  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap = new Map<TodoItemFlatNode, TodoItemNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap = new Map<TodoItemNode, TodoItemFlatNode>();

  /** A selected parent node to be inserted */
  selectedParent: TodoItemFlatNode | null = null;

  /** The new item's name */
  newItemName = '';

  treeControl: FlatTreeControl<TodoItemFlatNode>;

  treeFlattener: MatTreeFlattener<TodoItemNode, TodoItemFlatNode>;

  dataSource: MatTreeFlatDataSource<TodoItemNode, TodoItemFlatNode>;

  /** The selection for checklist */
  checklistSelection = new SelectionModel<TodoItemFlatNode>(
    true /* multiple */
  );

  constructor(private _database: ChecklistDatabase) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren
    );
    this.treeControl = new FlatTreeControl<TodoItemFlatNode>(
      this.getLevel,
      this.isExpandable
    );
    this.dataSource = new MatTreeFlatDataSource(
      this.treeControl,
      this.treeFlattener
    );

    _database.dataChange.subscribe((data) => {
      this.dataSource.data = data;
      console.log(' this.dataSource', this.dataSource);
    });
  }

  getLevel = (node: TodoItemFlatNode) => node.level;

  isExpandable = (node: TodoItemFlatNode) => node.expandable;

  getChildren = (node: TodoItemNode): TodoItemNode[] => node.children;

  hasChild = (_: number, _nodeData: TodoItemFlatNode) =>
    _nodeData.type === 'folder';

  hasNoContent = (_: number, _nodeData: TodoItemFlatNode) =>
    _nodeData.item === '';

  /**
   * Transformer to convert nested node to flat node. Record the nodes in maps for later use.
   */
  transformer = (node: TodoItemNode, level: number) => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode =
      existingNode && existingNode.item === node.item
        ? existingNode
        : new TodoItemFlatNode();
    flatNode.item = node.item;
    flatNode.id = node.id;
    flatNode.type = node.type;
    flatNode.level = level;
    flatNode.expandable = !!node.children?.length;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  };

  /** Whether all the descendants of the node are selected. */
  // descendantsAllSelected(node: TodoItemFlatNode): boolean {
  //   const descendants = this.treeControl.getDescendants(node);
  //   const descAllSelected =
  //     descendants.length > 0 &&
  //     descendants.every((child) => {
  //       return this.checklistSelection.isSelected(child);
  //     });
  //   return descAllSelected;
  // }

  /** Whether part of the descendants are selected */
  // descendantsPartiallySelected(node: TodoItemFlatNode): boolean {
  //   const descendants = this.treeControl.getDescendants(node);
  //   const result = descendants.some((child) =>
  //     this.checklistSelection.isSelected(child)
  //   );
  //   return result && !this.descendantsAllSelected(node);
  // }

  /** Toggle the to-do item selection. Select/deselect all the descendants node */
  // todoItemSelectionToggle(node: TodoItemFlatNode): void {
  //   this.checklistSelection.toggle(node);
  //   const descendants = this.treeControl.getDescendants(node);
  //   this.checklistSelection.isSelected(node)
  //     ? this.checklistSelection.select(...descendants)
  //     : this.checklistSelection.deselect(...descendants);

  //   // Force update for the parent
  //   descendants.forEach((child) => this.checklistSelection.isSelected(child));
  //   this.checkAllParentsSelection(node);
  // }

  /** Toggle a leaf to-do item selection. Check all the parents to see if they changed */
  // todoLeafItemSelectionToggle(node: TodoItemFlatNode): void {
  //   this.checklistSelection.toggle(node);
  //   this.checkAllParentsSelection(node);
  // }

  // /* Checks all the parents when a leaf node is selected/unselected */
  // checkAllParentsSelection(node: TodoItemFlatNode): void {
  //   let parent: TodoItemFlatNode | null = this.getParentNode(node);
  //   while (parent) {
  //     this.checkRootNodeSelection(parent);
  //     parent = this.getParentNode(parent);
  //   }
  // }

  // /** Check root node checked state and change it accordingly */
  // checkRootNodeSelection(node: TodoItemFlatNode): void {
  //   const nodeSelected = this.checklistSelection.isSelected(node);
  //   const descendants = this.treeControl.getDescendants(node);
  //   const descAllSelected =
  //     descendants.length > 0 &&
  //     descendants.every((child) => {
  //       return this.checklistSelection.isSelected(child);
  //     });
  //   if (nodeSelected && !descAllSelected) {
  //     this.checklistSelection.deselect(node);
  //   } else if (!nodeSelected && descAllSelected) {
  //     this.checklistSelection.select(node);
  //   }
  // }

  /* Get the parent node of a node */
  getParentNode(node: TodoItemFlatNode): TodoItemFlatNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }

  /** Select the category so we can insert the new item. */
  addNewItem(node: TodoItemFlatNode) {
    const parentNode = this.flatNodeMap.get(node);
    this._database.insertItem(parentNode!, '');

    this.treeControl.expand(node);
  }

  addNewRoot(node: TodoItemFlatNode) {
    const parentNode = this.flatNodeMap.get(node);
    this._database.insertFolderItem(parentNode!, '');

    this.treeControl.expand(node);
  }
  deleteItem(node: TodoItemFlatNode) {
    let parentNode = this.flatNodeMap.get(node);
    let flatNode = [] as any;
    if (this.dataSource.data.length > 0) {
      for (let j = this.dataSource.data.length - 1; j >= 0; j--) {
        flatNode = this.dataSource.data[j].children;
        if (flatNode.length > 0) {
          for (let i = flatNode.length - 1; i >= 0; i--) {
            if (flatNode[i].item === node.item) {
              if (parentNode.children) {
                console.log(parentNode.children);
              }

              this._database.deleteItem(flatNode, i, true, j);
            }
          }
        } else {
          this.deleteNode(node);
          console.log(node);
        }
      }
    } else {
      flatNode = this.dataSource.data[0].children;
      if (flatNode.length > 0) {
        for (let i = flatNode.length - 1; i >= 0; i--) {
          if (flatNode[i].item === node.item) {
            if (parentNode.children) {
              console.log(parentNode.children);
            }

            this._database.deleteItem(parentNode, i, true);
          }
        }
      } else {
        this.deleteNode(node);
      }
    }
  }

  // findIndexOfNestedArray(nestedArray, searchArray) {
  //   return searchArray.findIndex((item) => {
  //     if(item.children.length > 0){

  //     }else{
  //       return (item.every((a, i) => a === nestedArray[i])
  //       );
  //     }
  //   });
  // }

  addRootItem() {
    this._database.insertRootItem();
  }

  /** Save the node to database */
  saveNode(node: TodoItemFlatNode, itemValue: string) {
    const nestedNode = this.flatNodeMap.get(node);
    this._database.updateItem(nestedNode!, itemValue);
  }

  deleteNode(node: TodoItemFlatNode) {
    // debugger;
    console.log('node', node);

    const nestedNode = this.flatNodeMap.get(node);
    console.log('deleteNode', nestedNode);

    this._database.deleteItem(nestedNode!, 0, false);
  }

  addNewChildItem(node: TodoItemFlatNode) {
    const nestedNode = this.flatNodeMap.get(node);
    this._database.insertItem(nestedNode!, '');
    this.treeControl.expand(node);
    console.log('addNewChildItem', nestedNode);
  }

  deleteNewChildItem(node: TodoItemFlatNode) {
    const nestedNode = this.flatNodeMap.get(node);
    // this._database.deleteItem(nestedNode!, 0, true);

    console.log('addNewChildItem', nestedNode);
  }
}

/**  Copyright 2021 Google LLC. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */
