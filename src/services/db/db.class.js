/* eslint-disable no-unused-vars */
const errors = require('@feathersjs/errors');
const fetch = require('node-fetch');
const _ = require('lodash');
const uuidv4 = require('uuid/v4');


function parseResponse(response){
    if(response.errors.length > 0){
        return {errors: response.errors};
    }
    return response.results.map((res) =>{
        //initializes the data object with the column names.
        let data = res.columns.reduce((acc, cur)=>Object.assign(acc, {[cur]:{data:[],meta:[]}}),{});
        //populates the data object.
        data = res.data.reduce((acc, cur)=>{
            let sliceIndex = 0;
            for(let i = 0; i < res.columns.length; i++){
                let col = acc[res.columns[i]];
                if(Array.isArray(cur.row[i])){
                    let colMeta = cur.meta.slice(sliceIndex, sliceIndex+cur.row[i].length);
                    sliceIndex += cur.row[i].length;
                    col.data = col.data.concat(cur.row[i]);
                    col.meta = col.meta.concat(colMeta);

                }else{
                    col.data.push(cur.row[i]);
                }
            }
            return acc;
        }, data);
        return data;
    });
}


class Service {
    constructor (options) {
        this.options = options || {};
    }

  /* GET REST endpoint /db?{start}&{direction}&{distance}&{full}
   * Used to GET a list of dependencies
   *
   * start: Optional, used as the starting point for the search.
   *    accepted values: Any valid identifier.
   *    default value: "none".
   * direction: Optional, used to determine the direction of the search.
   *    accepted values: "Up", "Down"
   *    default values: "down"
   *    NOTE: Will be ignored if there is no 'start' value.
   * full: Optional, determines whether the search returns a list of objects or names.
   *    accepted values: "true", "false"
   *    default value: "true"
   */
    async find (params) {

        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "start": _.get(params, "query.start", "none").toLowerCase(),
            "direction": _.get(params, "query.direction", "down").toLowerCase(),
            "full": _.get(params, "query.full", "true").toLowerCase()
        };

        let sBuffer = {
            match: "MATCH p=(n2)-[*]->(n1) ",
            where: "",
            return: ""
        };
        if(query.start !== "none"){
            sBuffer.where = "WHERE n1.id = $id "
            if(query.direction === "up"){
                sBuffer.match = "MATCH p=(n1)-[*]->(n2) "
            }
        }
        if(query.full === "false"){

            if(query.start === "none"){
                sBuffer.match = "MATCH p=(n1) "
            }

            sBuffer.return = `UNWIND nodes(p) AS nodes
                            WITH collect(distinct nodes.name) AS names,
                            collect(distinct nodes.id) AS ids
                            RETURN names, ids`;
        }else{
            sBuffer.return =`UNWIND nodes(p) AS n
                            UNWIND relationships(p) AS r
                            WITH collect(distinct n) AS nodes,
                            collect(distinct r) AS edges
                            RETURN nodes, edges`;
        }
        let statement = sBuffer.match + sBuffer.where + sBuffer.return;

        init.body = JSON.stringify({
            statements: [
                {statement: statement,
                parameters: { id: query.start } }
            ]
        });

        let response = await fetch(url, init);
        let resData = await response.json();

        let parsedData = parseResponse(resData);


        if(parsedData.errors){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query
            });
            return Promise.reject(badRequest);
        }
        let result = Object.keys(parsedData[0]).reduce((acc, cur)=>{
            acc[cur] = parsedData[0][cur].data;

            //javaScript objects are passed by reference which means that changes made
            //to the objects filtered out will reflect on the objects in the accumulator.
            _.filter(parsedData[0][cur].data,(data)=>_.has(data, "name")).forEach((e)=>{
                //vis and neo4j uses 'label' and 'name' for the same purpose.
                e.label = e.name;
                delete e.name;
            });

            return acc;
        }, {});

        return result;
    }


  /* GET REST endpoint /db/{id}?{type}&{full}
   * Used to GET a single node or edge.
   *
   * id: Required, used to find the object in the database.
   *    accepted values: Any valid identifier.
   *    default value: None.
   * to: Optional, determines whether the database querries nodes or edges.
   *    accepted values: Any valid identifier.
   *    default value: None.
   *    NOTE: get will return an empty object if the to parameter
   *    does not refer to a node linked to id. ie. (id)--(to).
   * full: Optional, determines whether the databse returns a full object or identifier only.
   *    accepted values: "true", "false".
   *    default value: "true".
   *    NOTE: will be ignored if 'to' is set.
   */
    async get (id, params) {

        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "to": _.get(params, "query.to", "none").toLowerCase(),
            "full": _.get(params, "query.full", "true").toLowerCase()
        };

        let parameters = {id: id};
        let statement = "";

        let sBuffer = {
            match: "MATCH (n1) ",
            where: "WHERE n1.id = $id ",
            return: "RETURN n1 "
        };
        if(query.full === "false"){
            sBuffer.return = "RETURN {label: n1.name, id: n1.id} ";
        }
        if(query.to !== "none"){
            sBuffer.match = "MATCH (n1)-[r]-(n2) ";
            sBuffer.where = "WHERE n1.id = $id AND n2.id = $to ";
            sBuffer.return = "RETURN r "
            parameters.to = query.to;
        }
        statement = sBuffer.match + sBuffer.where + sBuffer.return;

        init.body = JSON.stringify({ statements:
            [{  statement: statement,
            parameters: parameters } ] });

        let res = await fetch(url, init);
        let resData = await res.json();

        if(_.get(resData, "errors", 0).length > 0){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query
            });
            return Promise.reject(badRequest);
        }

        let result = _.get(resData, "results[0].data[0].row[0]", {});
        if(_.has(result, "name")){
            result.label = result.name;
            delete result.name;
        }
        return result;

    }


    /* POST REST endpoint /db?{from}&{to}
   * Used to POST a single node or edge.
   * PARAMETERS:
   * from: Optional, determines whether the database querries nodes or edges.
   *    accepted values: Any valid identifier.
   *    default value: None.
   *    NOTE: get will return an empty object if the to parameter
   *    does not refer to a node linked to id. ie. (id)--(to).
   * to: Optional, determines whether the databse returns a full object or identifier only.
   *    accepted values: "true", "false".
   *    default value: "true".
   *    NOTE: will be ignored if 'to' is set.
   * REQUEST BODY:
   *    a valid json object containing the parameters of a new node or edge.
   *    NOTE: due to database limitations the object can't be more than two
   *    layers deep.
   */
    async create (data, params) {
      //AUTHORIZATION CHECK
        if(params.user.role !== "admin"){
            let forbidden = new errors.Forbidden("NOT AUTHORIZED!", {
                params: params.user.role
            });
            return Promise.reject(forbidden);
        }
        if (Array.isArray(data)) {
        return await Promise.all(data.map(current => this.create(current)));
        }

        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "from": _.get(params, "query.from", "none").toLowerCase(),
            "to": _.get(params, "query.to", "none").toLowerCase()
        };
        let statement = "";
        let sBuffer = {
            match: "",
            where: "",
            create: "CREATE (n1:node $data) ",
            return: "RETURN n1 "
        };

        if(_.has(data, "label")){
            data.name = result.label;
            delete result.label;
        }


        if(query.from !== "none" && query.to !== "none"){
            data.to = query.to;
            data.from = query.from;
            sBuffer.match = "MATCH (n1:node), (n2:node) ";
            sBuffer.where = "WHERE n1.id = $data.from AND n2.id = $data.to ";
            sBuffer.create = "CREATE (n1)-[r:dependency $data]->(n2) ";
            sBuffer.return = "RETURN r";
        }else{
            data.id = uuidv4();
        }

        statement = sBuffer.match+sBuffer.where+sBuffer.create+sBuffer.return;

        try{
            init.body = JSON.stringify({
                statements: [{
                    statement: statement,
                    parameters: {data: data}
                }]
            });
        }catch(e){
            let badRequest = new errors.BadRequest("Invalid JSON", {
                params: e
            });
            return Promise.reject(badRequest);
        }

        let res = await fetch(url, init);
        let resData = await res.json();

        if(_.get(resData, "errors", 0).length > 0){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query
            });
            return Promise.reject(badRequest);
        }

        let result = _.get(resData, "results[0].data[0].row[0]", {});
        if(_.has(result, "name")){
            result.label = result.name;
            delete result.name;
        }
        return result;
    }

    /*PUT REST endpoint /db/{id}?{to}
     * This verb will overwrite any existing data on the
     * target node/edge.
     * PARAMETERS:
     * id: Required, used to determine which object to update
     *  accepted values: Any valid id.
     *  default value: none
     * to: Optional, used with id to identify an edge.
     *  ex. (id)-[target]->(to)
     *  accepted values: Any valid id.
     *  default value: none.
     *
     * REQUEST BODY:
     *  a valid json object containing the new parameters of a node or edge.
     *  NOTE: due to database limitations the object can't be more than two
     *  layers deep.
     */
    async update (id, data, params) {
        if(params.user.role !== "admin"){
            let forbidden = new errors.Forbidden("NOT AUTHORIZED!", {
                params: params.user.role
            });
            return Promise.reject(forbidden);
        }

        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "to": _.get(params, "query.to", "none").toLowerCase()
        };
        let statement = "";
        let sBuffer = {
            match: "MATCH (n1:node) ",
            where: "WHERE n1.id = $data.id ",
            set: "SET n1 = $data ",
            return: "RETURN n1 "
        };

        if(_.has(data, "label")){
            data.name = result.label;
            delete result.label;
        }

        if(query.to !== "none"){
            data.to = query.to;
            data.from = id;
            sBuffer.match = "MATCH (n1:node)-[r:dependency]->(n2:node) ";
            sBuffer.where = "WHERE n1.id = $data.from AND n2.id = $data.to ";
            sBuffer.set = "SET r = $data ";
            sBuffer.return = "RETURN r ";
        }else{
            data.id = id;
        }

        statement = sBuffer.match+sBuffer.where+sBuffer.set+sBuffer.return;

        try{
            init.body = JSON.stringify({
                statements: [{
                    statement: statement,
                    parameters: {data: data}
                }]
            });
        }catch(e){
            let badRequest = new errors.BadRequest("Invalid JSON", {
                params: e
            });
            return Promise.reject(badRequest);
        }

        let res = await fetch(url, init);
        let resData = await res.json();

        if(_.get(resData, "errors", 0).length > 0){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query,
            });
            return Promise.reject(badRequest);
        }

        let result = _.get(resData, "results[0].data[0].row[0]", {});
        if(_.has(result, "name")){
            result.label = result.name;
            delete result.name;
        }
        return result;


    }

    /*PATCH REST endpoint /db/{id}?{to}
     * This verb will not overwrite any existing data on the
     * target node/edge unless explicitly provided with a new
     * value.
     * PARAMETERS:
     * id: Required, used to determine which object to update
     *  accepted values: Any valid id.
     *  default value: none
     * to: Optional, used with id to identify an edge.
     *  ex. (id)-[target]->(to)
     *  accepted values: Any valid id.
     *  default value: none.
     *
     * REQUEST BODY:
     *  a valid json object containing the new parameters of a node or edge.
     *  NOTE: due to database limitations the object can't be more than two
     *  layers deep.
     */
    async patch (id, data, params) {
        if(params.user.role !== "admin"){
            let forbidden = new errors.Forbidden("NOT AUTHORIZED!", {
                params: params.user.role
            });
            return Promise.reject(forbidden);
        }


        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "to": _.get(params, "query.to", "none").toLowerCase()
        };
        let statement = "";
        let sBuffer = {
            match: "MATCH (n1:node) ",
            where: "WHERE n1.id = $data.id ",
            set: "SET n1 += $data ",
            return: "RETURN n1 "
        };

        if(_.has(data, "label")){
            data.name = result.label;
            delete result.label;
        }

        if(query.to !== "none"){
            data.to = query.to;
            data.from = id;
            sBuffer.match = "MATCH (n1:node)-[r:dependency]->(n2:node) ";
            sBuffer.where = "WHERE n1.id = $data.from AND n2.id = $data.to ";
            sBuffer.set = "SET r += $data ";
            sBuffer.return = "RETURN r ";
        }else{
            data.id = id;
        }

        statement = sBuffer.match+sBuffer.where+sBuffer.set+sBuffer.return;

        try{
            init.body = JSON.stringify({
                statements: [{
                    statement: statement,
                    parameters: {data: data}
                }]
            });
        }catch(e){
            let badRequest = new errors.BadRequest("Invalid JSON", {
                params: e
            });
            return Promise.reject(badRequest);
        }

        let res = await fetch(url, init);
        let resData = await res.json();

        if(_.get(resData, "errors", 0).length > 0){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query,
            });
            return Promise.reject(badRequest);
        }

        let result = _.get(resData, "results[0].data[0].row[0]", {});
        if(_.has(result, "name")){
            result.label = result.name;
            delete result.name;
        }
        return result;


    }


    /*DELETE REST endpoint /db/{id}?{to}&{detach}
     * This verb will delete the target node or edge.
     * NOTE: a node with existing edges can't be deleted unless
     * you first remove the edges or set the detach parameter to true.
     * PARAMETERS:
     * id: Required, used to determine which object to delete
     *  accepted values: Any valid id.
     *  default value: none
     * to: Optional, used with id to identify an edge.
     *  ex. (id)-[target]->(to)
     *  accepted values: Any valid id.
     *  default value: none.
     * detach: optional, detaches (ie. deletes) all the edges connecting to
     * the node before deleting it.
     * NOTE: This argument is ignored if 'to' is set as the databse does not
     * support connecting edges to other edges.
     *
     */
    async remove (id, params) {
        if(params.user.role !== "admin"){
            let forbidden = new errors.Forbidden("NOT AUTHORIZED!", {
                params: params.user.role
            });
            return Promise.reject(forbidden);
        }

        let url = this.options.url;
        let init = Object.assign({}, this.options.init);
        let query = {
            "to": _.get(params, "query.to", "none").toLowerCase(),
            "detach": _.get(params, "query.detach", "false").toLowerCase()
        };


        let parameters = {id: id};
        let statement = "";

        let sBuffer = {
            match: "MATCH (n1:node) ",
            where: "WHERE n1.id = $id ",
            del: "DELETE n1 ",
            return: "RETURN n1 "
        };


        if(query.to !== "none"){
            sBuffer.match = "MATCH (n1:node)-[r:dependency]->(n2:node) ";
            sBuffer.where = "WHERE n1.id = $id AND n2.id = $to ";
            sBuffer.del = "DELETE r "
            sBuffer.return = "RETURN r ";
            parameters.to = query.to;
        }else if(query.detach === "true"){
            sBuffer.del = "DETACH DELETE n1 ";
        }

        statement = sBuffer.match + sBuffer.where + sBuffer.del + sBuffer.return;


        init.body = JSON.stringify({ statements:
            [{  statement: statement,
            parameters: parameters } ] });

        let res = await fetch(url, init);
        let data = await res.json();



        if(_.get(data, "errors", 0).length > 0){
            let badRequest = new errors.BadRequest("http 400 bad request", {
                params: params.query,
            });
            return Promise.reject(badRequest);
        }

        let result = _.get(data, "results[0].data[0].meta[0]", {});
        if(_.has(result, "id")){
            delete result.id;
        }

        return result;
    }
}

module.exports = function (options) {
  return new Service(options);
};

module.exports.Service = Service;
