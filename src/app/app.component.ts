import { Component, ViewChild, AfterViewInit } from '@angular/core';
import { Network, Data, DataSet, ClusterOptions } from "vis";
import { ElementRef } from "@angular/core";
import { schema } from "../../schemas/github.schema";
import * as moment from "moment";
import { NodeOptions } from 'vis';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css',
  '../assets/css/font-awesome-all-5.8.1.min.css']
})
export class AppComponent implements AfterViewInit {
  @ViewChild("container") el: ElementRef;
  title = 'vis-schema';
  
  nodes: DataSet<any>;
  edges: DataSet<any>;
  network: Network;

  nodeList: any[] = [];
  edgeList: any[] = [];

  stabilizationStart: moment.Moment;
  lastStabilizationProgress: moment.Moment;

  statusMessage: string = "";

  groups = [
    { name: "Type", icon: "\uf069", color: "#b2d1ff"},
    { name: "InputType", icon: "\uf069", color: "#0061f2"},
    { name: "Query", icon: "\uf069", color: "#47d36f"},
    { name: "Mutation", icon: "\uf069", color: "#c947e0"},
    { name: "Field", icon: "\uf5d2", color: "#d8e248"},
    { name: "Interface", icon: "\uf1c0", color: "#fcba2a"}
  ];
  
  physicsEnabled: boolean = false;
  showFields: boolean = false;
  showInterfaces: boolean = false;
  stabilizationIterations: number = 600;

  ngAfterViewInit() {
    this.init();
  }

  init() {
    this.initLists();
    this.getTypes();
    this.getNetwork();
  }

  initLists() {
    this.nodeList = [];
    this.edgeList = [];
  }
  getTypes() {
    this.statusMessage = "Generating network...";
    const types: any[] = schema.data.__schema.types;
    const queryType: string = (schema.data.__schema.queryType) ? schema.data.__schema.queryType.name : null;
    const mutationType: string = (schema.data.__schema.mutationType) ? schema.data.__schema.mutationType.name : null;
    const subscriptionType: string = (schema.data.__schema.subscriptionType) ? schema.data.__schema.subscriptionType.name : null;

    const objects: any[] = types.filter(x => 
      x.kind === "OBJECT"
      && ((queryType) ? x.name !== schema.data.__schema.queryType.name : null)
      && ((mutationType) ? x.name !== schema.data.__schema.mutationType.name : null)
      // && ((subscriptionType) ? x.name !== schema.data.__schema.subscriptionType.name : null)
    );
    const inputs: any[] = types.filter(x => 
      x.kind === "INPUT_OBJECT"
      && ((queryType) ? x.name !== schema.data.__schema.queryType.name : null)
      && ((mutationType) ? x.name !== schema.data.__schema.mutationType.name : null)
      // && ((subscriptionType) ? x.name !== schema.data.__schema.subscriptionType.name : null)
    );
    const interfaces: any[] = types.filter(x =>
      x.kind === "INTERFACE"
    );
    const queries: any[] = types.filter(x => x.kind === "OBJECT" && x.name === queryType)[0].fields;
    const mutations: any[] = types.filter(x => x.kind === "OBJECT" && x.name === mutationType)[0].fields;
    // const subscriptions: any[] = (subscriptionType) ? types.filter(x => x.kind === "OBJECT" && x.name === subscriptionType)[0].fields : null;
    
    objects.forEach(obj => {
      this.nodeList.push(this.createNode(obj, obj.name, obj.name, "Type"));
    });

    inputs.forEach(input => {
      this.nodeList.push(this.createNode(input, input.name, input.name, "InputType"));
    });

    queries.forEach(query => {
      this.nodeList.push(this.createNode(query, query.name, query.name, "Query"));
    });

    mutations.forEach(mutation => {
      this.nodeList.push(this.createNode(mutation, mutation.name, mutation.name, "Mutation"));
    });

    if (this.showInterfaces) {
      interfaces.forEach(i => {
        this.nodeList.push(this.createNode(i, i.name, i.name, "Interface"));
      });
    }

    this.nodeList.forEach(node => {
      if(node.fields){
        node.fields.forEach(field => {
          if (this.showFields) {
            this.nodeList.push(this.createNode(field, node.name + "_" + field.name, field.name, "Field"));
            this.edgeList.push(this.createEdge(node.id, field.id));
          }
          const edges = this.nodeList.filter(x => this.isOfType(x.name, field.type));
          edges.forEach(edge => {
            this.edgeList.push(this.createEdge(node.id, edge.id));
          });            
        
        });
      }

      if (node.type) {
        this.createEdges(node.id, node.type);
      }
      if (node.args) {
        node.args.forEach(arg => {
          this.createEdges(node.id, arg.type);
        });        
      }
      if (node.possibleTypes) {
        node.possibleTypes.forEach(pt => {
          // connection already defined.  create edges explicitly.
          this.edgeList.push(this.createEdge(node.id, pt.name));
        });
      }
    });

    this.nodes = new DataSet<any>(this.nodeList);
    this.edges = new DataSet<any>(this.edgeList);
    this.generateNodeConfig();
  }

  createNode(obj: any, id: string, name: string, group: string): any {
    obj["id"] = id;
    obj["label"] = name;
    obj["group"] = group;
    obj["title"] = "Type: " + this.getType(obj);
    return obj;
  }

  // id: id of the node you want to create an edge from
  // typeObj: obj containing the type information used to compare other objects against.
  createEdges(id:string, typeObj:any) {
    const edges = this.nodeList.filter(x => this.isOfType(x.name, typeObj));
    edges.forEach(edge => {
      this.edgeList.push(this.createEdge(id, edge.id));
    })
  }

  private createEdge(from: string, to: string) {
    let edge = {
      "from": from,
      "to": to,
      "color":{inherit:'both'}
    };
    return edge;
  }

  isOfType(typeName: string, type: any): boolean {
    if (!type) {
      return false;
    } else if (type.kind !== "OBJECT" && type.kind !== "INPUT_OBJECT" && type.kind !== "INTERFACE") {
      return this.isOfType(typeName, type.ofType);
    } else if (type.name === typeName) {
      return true;
    }
    return false;
  }

  getType(obj: any) {
    if (!obj || !obj.type) {
      return null;
    }
    const NON_NULL: boolean = (obj.type.kind === "NON_NULL");
    if (obj.ofType) {
      return this.getType(obj.ofType) + (NON_NULL) ? "!" : "";
    } else {
      return obj.name;
    }
  }

  generateNodeConfig(id?:number) {
    this.statusMessage = "Generating node config...";
    this.nodes.forEach(node => {
      if (id && id !== node.id) {
        return;
      }
      const groupConfig = this.groups.find(group => group.name === node.group);
      let color = groupConfig.color;
      let icon = groupConfig.icon;
      node['color'] = color;
      node['icon'] = {face: 'FontAwesome', code: icon, color: color};

      this.nodes.update(node);
    });
  }

  generateClusters() {
    this.statusMessage = "Generating clusters...";
    this.nodes.forEach(node => {
      if (node.group === 'Type') {
        const clusterOptions: ClusterOptions = {
          joinCondition: (nodeOptions: NodeOptions) => {
            return nodeOptions.group === 'Field';
          },
          clusterNodeProperties: {borderWidth:1, shape:'box', size:60}
        };
        this.network.clusterByConnection(node.id, clusterOptions);
      }
    });
  }

  getNetwork() {
    const data: Data = { nodes: this.nodes, edges: this.edges};
    const el: ElementRef = this.el;
    const container: HTMLElement = el.nativeElement;
    this.network = new Network(container, data, this.getOptions());

    // network events
    this.network.on("selectNode", function(params) {
      if (params.nodes.length == 1) {
        if (this.isCluster(params.nodes[0]) == true) {
          this.openCluster(params.nodes[0]);
        }
      }
    });
    this.network.on("animationFinished", () => console.log("Animation Finished"));
    this.network.on("startStabilizing", () => {
      this.stabilizationStart = moment(new Date());
      this.statusMessage = "Stabilization Started: " + this.stabilizationStart.format("YYYY-MM-DD HH:mm:ss");
      console.log(this.statusMessage);
    });
    this.network.on("stabilizationProgress", (progress) => {
      if (!this.lastStabilizationProgress) {
        this.lastStabilizationProgress = this.stabilizationStart;
      }
      this.statusMessage = "Stabiliztion Progress: " + progress.iterations + " of " + progress.total + " (" + moment.duration(moment(new Date()).diff(this.lastStabilizationProgress, 'seconds', true)) + "s)";
      console.log(this.statusMessage);
      this.lastStabilizationProgress = moment(new Date());
    });
    this.network.on("stabilizationIterationsDone", () => {
      this.statusMessage = "Stabilization Iterations Done! Duration: " + moment.duration(moment().diff(this.stabilizationStart, 'seconds', true)) + "s";
      console.log(this.statusMessage);
      this.network.setOptions( { physics: this.physicsEnabled } );
    });
    return this.network;
  }

  getOptions() {
    return {
      // physics: {
      //   enabled: true,
      //   solver: "barneshut",
      //   stabilization: {
      //     enabled: true,
      //     iterations: 2000
      //   }
      // },
      physics: {
        enabled: true,
        solver: "forceAtlas2Based",
        stabilization: {
          enabled: true,
          iterations: this.stabilizationIterations
        }
      },
      layout: {
        improvedLayout: false
      },
      interaction: {
        hideEdgesOnDrag: true,
        tooltipDelay: 200
      },
      nodes: {
        shape: 'dot',
        scaling: {
          min: 10,
          max: 30
        },
        font: {
          size: 10,
          color: '#000'
        },
        borderWidth: 1,
        borderWidthSelected: 4
      },
      edges: {
        width: 0.15,
        color: {inherit:'from'},
        selectionWidth: 4,
        smooth: true
      },
      groups: {
        Type: {
          shape: 'dot'
        },
        InputType: {
          shape: 'dot'
        },
        Query: {
          shape: 'icon',
          icon: {
            face: 'FontAwesome',
            size: 150
          }
        },
        Mutation: {
          shape: 'icon',
          icon: {
            face: 'FontAwesome',
            size: 150
          }
        },
        Field: {
          shape: 'dot'
        },
        Interface: {
          shape: 'dot'
        },
      }
    }
  }
}
