/** Constructor for a piechart visualization
 * p: the margin width
 * y: the right margin
 * r: radius of the piechart
 * title: of the graph
 * hLabels: A list of labels for the hint path, indicating all the different views of the visualization
 */
function Piechart(p, w,h,title,hLabels){
    //Save some display properties
   this.padding = p;
   this.graphTitle = title;
   this.hintRadiusSpacing = 25;

   //Height and width of SVG can be calculated based on radius
   this.width = w;
   this.height = h;
   this.radius = (w*0.7)/2;
   this.labelOffset = this.radius;
    this.cx = this.radius; //Center of the piechart
    this.cy = this.radius+this.padding;

   //Variables to save display information
   this.svg = null; //Reference to svg container
   this.corners = [];  //Corners of the hint path
   this.labels = hLabels;
   this.numArcs = -1; //Total number of arcs in the piechart
   this.segmentLabels = [];
   this.hintPathType = 0;
   this.useMobile = false;
   this.colours = 0;

   //View index tracker variables
   this.currentView = 0; //Starting view of the piechart (first year)
   this.nextView = 1;

   this.lastView = hLabels.length-1;
   this.numViews = hLabels.length;
   this.startAngles = [];//Saves the start and end angles each time they are changed
   this.endAngles = [];
   this.dragStartAngle = 0;  //The starting angle for the pie segment being dragged
   this.draggedSegment = 0; //Id of the dragged segment
   this.interpValue=0;
   this.timeDirection = 1; //Tracks the direction travelled (forward or backward in time) to infer the next view
                               //1 if going forward, -1 if going backward
   this.previousDragDirection = 1;
   this.mouseAngle = -1; //Save the angle of the previously dragged segment
   this.mouseX = 0;
   this.mouseY = 0;
   this.hintArcInfo = []; //The points and radii along the hint path
   this.angleThreshold = 0.05;

   this.ambiguousSegments = [];
   this.interactionPaths = [];
   this.isAmbiguous = 0;
   this.amplitudeHeight = 20; //Of the sine wave (interaction path)
   this.amplitude = 0.1;
   this.peakValue = null; //The y-value of the sine wave's peak (or trough)
   this.passedMiddle = -1; //Passed the mid point of the peak of the sine wave
   this.pathDirection = -1; //Directon travelling along an interaction path
   this.atCorner = -1; //The view index of a corner formed by an end point of the sine wave and the hint path

   //Constants for angle calculations involving PI
   this.pi = Math.PI;
   this.halfPi = Math.PI/2;
   this.twoPi = Math.PI*2;

   //Event functions, declared in the init.js file
   this.clickHintLabelFunction = {};
   this.clickSVG = {};
   this.dragEvent = null;

  //Function for drawing the arc segments
   this.arcGenerator = d3.svg.arc().innerRadius(0).outerRadius(this.radius)
					   .startAngle(function (d) {return d.startAngle;})
					   .endAngle(function (d) {return d.endAngle;});
   //Function for drawing a sine wave
   this.interactionPathGenerator = d3.svg.line().interpolate("monotone");
  //Function for drawing a straight line
   this.lineGenerator = d3.svg.line().interpolate("linear");
  //Interpolate function between two values, at the specified amount
   this.interpolator = function (a,b,amount) {return d3.interpolate(a,b)(amount)};
}
/**Colour constants */
Piechart.prototype.labelColour = "#666";
 /** Append a blank svg and g container to the div tag indicated by "id", this is where the visualization
 *  will be drawn. Also, add a blur filter for the hint path effect.
 * */
Piechart.prototype.init = function(){
   this.svg = d3.select("#mainSvg")
       .append("g").attr("id","gPiechart")
       .attr("transform", "translate(" + this.padding + "," + this.padding + ")");

   //Add blur filters to the SVG so other elements can call it
    this.svg.append("svg:defs").append("svg:filter")
     .attr("id", "blur").append("svg:feGaussianBlur")
     .attr("stdDeviation", 2);

    /**this.svg.append("svg:defs").append("svg:filter")
        .attr("id", "blur2").append("svg:feGaussianBlur")
        .attr("stdDeviation", 3);*/
 }
/** Render the visualization onto the svg
 * data: The dataset to be visualized
 * start: The starting view of the visualization, as an index into the labels array
 * Data MUST be provided in the following array format:
 * Object{"values":{v1,v2...vn}, //Values are between 0 and 1
 *        "label":"name of pie segment" } ..... number of pie segments
 * */
 Piechart.prototype.render = function(data){
      var ref = this;
	  this.numArcs = data.length-1;
      //this.colours = colorbrewer.Dark2[data.length];
	  this.colours = colorbrewer.Set2[data.length];
      var colourScale;
     //Create a colour scale for the pie segments
     if (this.numArcs <= this.colours.length){
         colourScale = d3.scale.quantize().domain([0,this.numArcs]).range(this.colours);
     }else{
         colourScale = d3.scale.linear().domain([0,this.numArcs]).range(this.colours);
     }

	//Assign the data to the paths drawn as pie segments
	this.svg.selectAll("path").data(data.map(function (d,i) {
                 var angles = [];
                //Calculate and save the angle values based on a given percentage value (as a decimal)
                for (var j=0;j< ref.numViews;j++){
                    angles[j] = d.values[j]*ref.twoPi;
                }
                ref.segmentLabels[i] = d.label;
                return {nodes:angles,label:d.label,id:i,startAngle:0,endAngle:0,colour:colourScale(i)};
          }))
         .enter().append("g").attr("class","gDisplayArcs");

 //Find the start and end angles for the current view
 this.calculateLayout(this.svg.selectAll(".gDisplayArcs").data().map(function (d){return d.nodes[ref.currentView]}),0,0);

 //Render the pie segments
 this.svg.selectAll(".gDisplayArcs").append("path")
         .attr("fill",function (d){return d.colour;})
         .attr("transform", "translate(" + this.cx + "," + this.cy + ")")
         .attr("id", function (d) {return "displayArcs"+d.id;})
         .attr("class","displayArcs")
         .attr("d", function (d) {
                d.startAngle = ref.startAngles[d.id];
                d.endAngle = ref.endAngles[d.id];
               return ref.arcGenerator(d);
         });
         //.append("title").text(function(d){return d.label;});

 //Add labels to each segment
 //this.addLabels(); Not working

 // Add the title of the chart
 this.svg.append("text").attr("id", "graphTitle").text(this.graphTitle).attr("x",10).attr("y",13).attr("class","axis");

 //Add a g element to contain the hint info
 this.svg.append("g").attr("id","hintPath");
 }
/**Adds labels to the piechart segments (but does not size the font based on the width of the segment)
 * Not being used right now..

Piechart.prototype.addLabels = function (){
    var ref = this;

    this.svg.selectAll(".gDisplayArcs").append("text")
     .attr("transform", function (d,i){
          return "translate(" + ref.arcGenerator.centroid(d) + ")";
     })
     .attr("fill", "#000")
     .text("Test");
}*/
/** Re-calculates layout of the piechart for a list of angles
 *  The angles are saved in the global arrays startAngles, and endAngles
 *  angles: a 1D array containing the angle values of each segment for one view
 *  start: indicates at which angle to start drawing from (usually w.r.t the startAngle of the dragged angle)
 *  id: index of the dragged segment corresponding to start
 * */
Piechart.prototype.calculateLayout = function (angles,start,id){
    var angleSum, currentAngle;

    //Adjust the id (if using the slider)
    var newId  = id;
    if (id==-1){newId = this.draggedSegment}

    //First assign the start and end angles to the currently dragged segment (id)
    var endAngle = start+angles[newId];
    this.startAngles[newId] = start;
    this.endAngles[newId] = endAngle;
    angleSum = endAngle;
    var totalAngles = angles[newId];

    //Then, assign start/end angles to all segments whose indices occur after id (> id)
    for (var j=(newId+1);j<angles.length;j++){
        currentAngle = angles[j];
        this.startAngles[j] = angleSum;
        this.endAngles[j] = angleSum + currentAngle;
        angleSum += currentAngle;
        totalAngles+=currentAngle;
    }
    //Now assign start/end angles to all segments with indices before id (0 to <id)
    for (var j=0;j<newId;j++){
        currentAngle = angles[j];
        this.startAngles[j] = angleSum;
        this.endAngles[j] = angleSum + currentAngle;
        angleSum += currentAngle;
        totalAngles+=currentAngle;
    }
    //console.log("sum "+totalAngles*180/Math.PI);
    //console.log("ends "+this.endAngles.map(function (d){return d*180/Math.PI})+" starts "+this.startAngles.map(function (d){return d*180/Math.PI}));
    //console.log("angles "+angles.map(function (d){return d*180/Math.PI}));
}
/** Compares the dragging angle of the mouse with the two bounding views (using the
 *  endAngles along the hint path).  From this comparison, the views are resolved and
 *  (if needed), the piechart segments are re-drawn based on the dragging amount
 *  id: The id of the dragged segment
 * */
Piechart.prototype.updateDraggedSegment = function (id,mouseX, mouseY,nodes){

    //Calculate the angle of the dragged segment
    var angle = this.findMouseAngle(mouseX,mouseY);

    //Find the angles for the current and next view
    var current = nodes[this.currentView];
    var next =  nodes[this.nextView];

    //Find the current angular dragging direction
    var draggingDirection = (angle > this.mouseAngle)? 1 : (angle < this.mouseAngle)? -1 : this.previousDragDirection;

    //Re-set the time direction and dragging direction if the dragging has just started
    if (this.timeDirection ==0){
        this.timeDirection = 1; //Forward in time by default
        draggingDirection = this.previousDragDirection;
    }
    //console.log(angle*180/Math.PI+" "+this.mouseAngle*180/Math.PI+" "+this.previousDragDirection+" "+draggingDirection);

    if (this.isAmbiguous==1){ //Might be at a stationary sequence

        var currentAmbiguous = this.ambiguousSegments[this.currentView];
        var nextAmbiguous = this.ambiguousSegments[this.nextView];

        if (currentAmbiguous[0] == 1 && nextAmbiguous[0] == 0){
            setSineWaveVariables(this,currentAmbiguous[2],current,1);
            if((current>next && this.pathDirection==1) || (current<next && this.pathDirection==-1)){ //Detect if the sine wave and regular hint path form a peak at end point
                this.atCorner = this.currentView;
            }
            this.handleDraggedSegment(id,current,next,angle, nodes,draggingDirection);
        }else if (currentAmbiguous[0] == 0 && nextAmbiguous[0] == 1){
            setSineWaveVariables(this,-1,next,0);
            //Detect if the sine wave and regular hint path form a peak at end point
            if(current>next){
                this.atCorner = this.nextView;
            }
            this.handleDraggedSegment(id,current,next,angle, nodes,draggingDirection);
        }else if (currentAmbiguous[0] == 1 && nextAmbiguous[0] == 1){ //In middle of sequence
            //Dragging has started in the middle of a sequence, need to determine the time direction based on the vertical dragging direction
            if (this.passedMiddle == -1){
                setSineWaveVariables(this,draggingDirection,current,0);
                //If vertical dragging indicates the time direction should move backwards, in this case need to update the view variables
                if (this.pathDirection != currentAmbiguous[2] && this.currentView>0){
                    this.passedMiddle = 1;
                    moveBackward(this,draggingDirection);
                }
            }
            this.handleDraggedSegment_stationary(id,current,angle, nodes,draggingDirection);
        }else{ //No stationary case to handle right now
            this.atCorner = -1;
            this.handleDraggedSegment(id,current,next,angle,nodes,draggingDirection);
        }
    } else{ //No ambiguity on the entire hint path
        this.handleDraggedSegment(id,current,next,angle,nodes,draggingDirection);
    }

    //Save some values
    this.mouseAngle = angle;
    this.previousDragDirection = draggingDirection;
    this.mouseX = mouseX;
    this.mouseY = mouseY;
    //console.log(this.timeDirection);
    //this.redrawAnchor(angle);
}
/** Calculates the angle of the mouse w.r.t the piechart center
 *  mouseX, mouseY: coordinates of the mouse
 * @return the positive dragging angle in radians
 * */
Piechart.prototype.findMouseAngle = function (mouseX,mouseY){
    var adj = mouseX - this.cx;
    var opp = this.cy - mouseY;
    var angle = Math.atan2(adj,opp);

    //Wrapped around 180, make angle positive
    if (angle < 0){	angle = (this.pi - angle*(-1))+this.pi;}
    angle = angle - this.dragStartAngle;
    //Wrapped around 360, adjust the angle according to the start angle
    if (angle < 0){ angle = (this.twoPi - this.dragStartAngle)+(angle + this.dragStartAngle)}

    return angle;
}
/** Finds the new end angle of a dragged pie segment
 *  current,next: the angles corresponding to current and next views
 *  mouseAngle: the dragging angle
 *  id: of the dragged segment
 *  draggingDirection: angular direction
 *  @return new end angle of the dragged segment
 * */
Piechart.prototype.handleDraggedSegment = function(id,current,next,mouseAngle,nodes,draggingDirection){

   //Check to see if the mouse angle is in between current and next, or beyond one of them
    var bounds = checkBounds(this,current,next,mouseAngle);

    //Change views or update the view
    if (bounds == mouseAngle){
        findInterpolation(this,current,next,mouseAngle,0,draggingDirection);
        this.interpolateSegments(id, mouseAngle,this.currentView,this.nextView,this.interpValue);
        this.animateHintPath(nodes);
    }else if (bounds == current) { //At current
        if (this.corners[this.currentView]==1 || this.atCorner == this.currentView){ //Current is a corner, or a corner formed by the sine wave and hint path
            inferTimeDirection(this,draggingDirection,1);
        }else{
            moveBackward(this,draggingDirection);
        }
        this.redrawView(this.currentView,id);
    }else{ //At next
        if (this.corners[this.nextView]==1 || this.atCorner == this.nextView){ //Next is a corner, or a corner formed by the sine wave and hint path
            inferTimeDirection(this,draggingDirection,0);
        }else{
            moveForward(this,draggingDirection);
           // var coords = this.calculatePolarCoords(mouseAngle,this.radius);
           // console.log(findPixelDistance(this.mouseX,this.mouseY,coords[0],coords[1]));
        }
        this.redrawView(this.nextView,id);
    }
}
/** Calculates the polar coordinates of an angle on the piechart
 *  @return an array [x,y] containing the coordinates
 * */
Piechart.prototype.calculatePolarCoords = function (angle,radius){
     var px = this.cx + radius*Math.cos(angle);
     var py = this.cy + radius*Math.sin(angle);
     return [px,py];
}
  /** Resolves a dragging interaction in a similar method as handleDraggedSegment, except
 *  this function is only called when in the middle of a stationary sequence of segments.
 *  angle: The angle of the stationary segment
 *  id: of the dragged segment
 *  nodes: d.nodes data from the dragged segment
 * */
//TODO: this function may have problems handling angles which wrap around 0/360
 Piechart.prototype.handleDraggedSegment_stationary = function (id,angle,mouseAngle,nodes,draggingDirection){

     //If atCorner is set to an index, it means that the first/last point on the sine wave is forming a corner (ambiguous region) with the hint path
     if (this.atCorner!=-1){ //At one end point on the sine wave
         if (draggingDirection != this.previousDragDirection){ //Permit view updates when the dragging direction changes
             this.atCorner = -1;
         }
     }

     var bounds = checkBounds(this,this.peakValue,angle,mouseAngle);

    if (bounds == mouseAngle){
        findInterpolation(this,angle,this.peakValue, mouseAngle, 1,draggingDirection);
        this.interpolateSegments(id, angle,this.currentView,this.nextView,this.interpValue);
        this.animateHintPath(nodes);
    }else if (bounds == this.peakValue){ //At boundary
        if (draggingDirection != this.previousDragDirection){
            if (this.timeDirection ==1){this.passedMiddle = 1}
            else {this.passedMiddle =0;}
        }
        this.interpValue = 0.5;
    }else{ //At base
        if (this.atCorner==-1){
            var newPathDirection = (this.pathDirection==1)?-1:1;
            //Update the view
            if (this.timeDirection ==1 && this.nextView < this.lastView){
                moveForward(this,draggingDirection);
                setSineWaveVariables(this,newPathDirection,angle,0);
            }
            else if (this.timeDirection ==-1 && this.currentView >0){
                moveBackward(this,draggingDirection);
                setSineWaveVariables(this,newPathDirection,angle,1);
            }else if (this.nextView == this.lastView){
                if (draggingDirection != this.previousDragDirection){ //Flip the direction when at the end of the hint path
                    this.timeDirection = (this.timeDirection==1)?-1:1;
                    this.atCorner = this.nextView;
                }
            }
        }
    }

}

/******Draw an anchor to show which side of a segment is draggable *****/

/** Appends an anchor to the svg, if there isn't already one */
Piechart.prototype.appendAnchor = function (angle){

    if (this.svg.select("#segmentAnchor").empty()){
        var c = this.calculatePolarCoords(this.convertAngle(angle),this.radius+10);
       //this.svg.select("#hintPath").append("circle").attr("r",4).attr("id","anchor").attr("stroke","none");
        this.svg.select("#hintPath").append("path").attr("d",this.lineGenerator([[this.cx,this.cy],[c[0],c[1]]]))
            .attr("id","segmentAnchor").attr("stroke","#2ca02c");
    }
}
/** Re-draws the anchor along with the dragged segment
 * */
Piechart.prototype.redrawAnchor = function (angle){
    var c = this.calculatePolarCoords(this.convertAngle(angle+this.dragStartAngle),this.radius+10);
    this.svg.select("#segmentAnchor").attr("d",this.lineGenerator([[this.cx,this.cy],[c[0],c[1]]]));
}
/** Removes the anchor from the svg
 * */
Piechart.prototype.removeAnchor = function (){
    if (!this.svg.select("#segmentAnchor").empty()){
        this.svg.select("#segmentAnchor").remove();
    }
}
/**"Animates" the rest of the segments while one is being dragged
 * Uses the interpAmount to determine how far the segment has travelled between the two angles
 * defined at start and end view. The angles of the other bars are estimated using the
 * interpAmount and re-drawn at the new angles
 * id: The id of the dragged segment
 * mouseAngle: the angle of the dragged segment
 * startView,endView: Define the range to interpolate across
 * */
Piechart.prototype.interpolateSegments = function (id,mouseAngle,startView,endView,interpAmount){
    var ref = this;
    var newAngles = [];

	this.svg.selectAll(".displayArcs").each(function (d) {
       if (d.id == id){newAngles.push(mouseAngle);}
       else{newAngles.push(ref.interpolator(d.nodes[startView], d.nodes[endView], interpAmount));}
	 });

    this.calculateLayout(newAngles,this.dragStartAngle,id);

    //Redraw the segments at the interpolated angles
    this.svg.selectAll(".displayArcs").attr("d", function (d){
            d.startAngle = ref.startAngles[d.id];
            d.endAngle = ref.endAngles[d.id];
            return ref.arcGenerator(d);
        });
}
/** Animates the hint path by angular translating it corresponding to the dragging amount
 * angles: an array of all angles to appear on the hint path
 * */
//TODO: might need a better way of animating, should not have to re-calculate all points each time, should use transforms (e.g., translate x,y and scale the size of the arc)
 Piechart.prototype.animateHintPath = function (angles){
    var ref = this;
    var hintArcInfo = ref.calculateHintAngles(angles,null,1);
    var hintPathArcString = ref.createArcString(hintArcInfo,false);

    //Redraw the hint path
    this.svg.selectAll(".path").attr("d", hintPathArcString);

    //Update the hint labels
   this.svg.selectAll(".hintLabels").attr("transform",function (d) {
       return "translate("+hintArcInfo[d.id][0]+","+hintArcInfo[d.id][1]+")";
    }).style("fill-opacity",function (d){return ref.interpolateLabelOpacity(d)})
      .style("fill",this.labelColour);

    //Redraw interaction path(s) if any
    if (this.isAmbiguous==1){
           this.svg.selectAll(".interactionPath").attr("d",function (d) {
                var xTranslate = hintArcInfo[d.view][0];
                var yTranslate = hintArcInfo[d.view][1];
                var translatedPoints = d.points.map(function (b){return [b[0]+xTranslate,b[1]+yTranslate]});
                d3.select(this).attr("transform","rotate("+d.rotationAngle+","+xTranslate+","+yTranslate+")");
                return ref.interactionPathGenerator(translatedPoints);
            });
    }
     if (this.hintPathType ==1){
         redrawSmallHintPath(this,this.ambiguousSegments,0);
     }
}
/** Interpolates across two labels to show the user's transition between views
 * d: a node from .hintLabels
 * */
Piechart.prototype.interpolateLabelOpacity = function (d){
    if (d.id ==this.currentView){ //Dark to light
        return d3.interpolate(1,0.5)(this.interpValue);
    }else if (d.id == this.nextView){ //Light to dark
        return d3.interpolate(0.5,1)(this.interpValue);
    }
    return 0.5;
}
/** Darkens the label colour opacity of one view label and keeps the rest faded out,
 *  to show the current view when dragging a segment
 * */
Piechart.prototype.changeLabelOpacity = function (d,view){
    return (d.id==view)?1:0.5;
}
/**Snaps to the nearest view in terms of mouse angle and the two views bounding the time frame
 * id: of the dragged segment
 * allAngles: of the dragged segment (across all views)
 * mouseAngle: the angle of the mouse
 * */
 Piechart.prototype.snapToView = function (id,allAngles){
    var currentDist, nextDist;

   //Check if the views are an ambiguous case, set the distances
   if (this.ambiguousSegments[this.currentView][0]==1 && this.ambiguousSegments[this.nextView][0]==1){
         if (this.interpValue > 0.5){ //Snap to nextView
             currentDist = 1;
             nextDist = 0;
         }else{ //Snap to current view
             currentDist = 0;
             nextDist = 1;
         }
    }else{
         currentDist = Math.abs(allAngles[this.currentView] - this.mouseAngle);
         nextDist = Math.abs(allAngles[this.nextView] - this.mouseAngle);
    }

    //Ensure the nextView wasn't the last one to avoid the index going out of bounds
    if (currentDist > nextDist && this.nextView <= this.lastView){
         this.currentView = this.nextView;
         this.nextView++;
    }

    this.redrawView(this.currentView,id);
    this.redrawHintPath(this.currentView,allAngles);
 }
/** Redraws the piechart at a specified view, by re-calculating the layout
 *  view: the view to draw at
 *  id: of the currently or previously dragged segment
 * */
 Piechart.prototype.redrawView = function (view,id){
   var ref = this;
   var newAngles = [];
   newAngles = this.svg.selectAll(".displayArcs").data().map(function (d){return d.nodes[view]});

   //Recalculate the piechart layout at the view
   this.calculateLayout(newAngles,this.dragStartAngle,id);

   //Redraw the piechart at the new view
   this.svg.selectAll(".displayArcs").attr("d", function (d){
             d.startAngle = ref.startAngles[d.id];
             d.endAngle = ref.endAngles[d.id];
             return ref.arcGenerator(d);
         });
}
/**Re-draws the hint path at a specified view
 * view: the view to draw at
 * angles: a 1D array of all angles along the hint path
 * */
Piechart.prototype.redrawHintPath = function (view,angles){
    var ref = this;
    var hintArcInfo = this.calculateHintAngles(angles,view,0);
    var hintPathArcString = this.createArcString(hintArcInfo,false);

    //Redraw the hint path
    this.svg.selectAll(".path").attr("d", hintPathArcString);

    //Update the hint labels and change the opacity to show current view
    this.svg.selectAll(".hintLabels").attr("transform",function (d,i) {
        return "translate("+hintArcInfo[i][0]+","+hintArcInfo[i][1]+")";
    }).style("fill-opacity",function (d){return ref.changeLabelOpacity(d,view)})
       .style("fill",this.labelColour).style("font-family","sans-serif").style("font-size","10px")
	   .style("font-weight","bold").style("text-anchor","middle");
    

    //Redraw the interaction path(s) if any
    if (this.isAmbiguous ==1){
        this.svg.selectAll(".interactionPath").attr("d",function (d) {
            var xTranslate = hintArcInfo[d.view][0];
            var yTranslate = hintArcInfo[d.view][1];
            var translatedPoints = d.points.map(function (b){return [b[0]+xTranslate,b[1]+yTranslate]});
            d3.select(this).attr("transform","rotate("+d.rotationAngle+","+xTranslate+","+yTranslate+")");
            return ref.interactionPathGenerator(translatedPoints);
        });
        this.removeAnchor(); //Anchor will be re-appended in showHintPath()
    }
}
/** Calculates the hint angles for drawing a hint path, an array stores
 *  the x,y position for drawing the label, the radius of the arc and
 *  the new angle value (along the hint path) for each angle value along
 *  the hint path.
 * angles: 1D array of all angles belonging to the hint path
 * view: the current view to draw at
 * flag: if set to 0, no interpolation
 *       if set to 1, interpolate between current and next view
 * */
Piechart.prototype.calculateHintAngles = function (angles,view,flag){
  //Hint path design: separate radius for each year
  var newAngle, r;
  var hintAngles = [];
  for (var j=0;j<angles.length;j++){
       //Calculate the new information
        newAngle = this.dragStartAngle + angles[j];
        if (flag ==0){
            r = this.findHintRadius(j,view);
        }else{
            r = this.interpolateHintRadius(j,this.currentView,this.nextView);
        }
        var c =  this.calculatePolarCoords((newAngle - this.halfPi),r);
        hintAngles.push([c[0],c[1],r,newAngle]);
  }
   return hintAngles;
}
/** This function analyzes the hint path data to do the following:
 *  Calculate hint path coordinates, radius etc.
 *  Detect corners (changes in angular direction)
 * */
Piechart.prototype.processHintPathInfo = function (angles,view){
    //Hint path design: separate radius for each year
    var newAngle, r, x, y,previousDirection,prevAngle;
    var currentDirection = 1;

    var hintAngles = [];
    this.corners = [];
    //Re-set the array
    for (j=0;j<=this.lastView;j++){
        this.corners[j] = 0;
    }

    for (var j=0;j<=this.lastView;j++){

        //Step 1: Calculate the new hint path information for this angle
        newAngle = this.dragStartAngle + angles[j];
        r = this.findHintRadius(j,view);
        var c = this.calculatePolarCoords((newAngle - this.halfPi),r);
        hintAngles.push([c[0],c[1],r,newAngle]);

        //Step 2: Determine if the angle is on a corner (only if it's not already ambiguous)
        if (j>0){
            currentDirection = (newAngle>prevAngle)?1:0;
            if (previousDirection != currentDirection && this.ambiguousSegments[j-1][0]!=1 && (j-1)>0){
                this.corners[j-1] = 1;
            }
        }

        //Save some information
        previousDirection = currentDirection;
        prevAngle = newAngle;
    }
    return hintAngles;
}
/** Called each time a new segment is dragged.  Searches for ambiguous regions, and draws the hint path
 * id: the id of the dragged segment
 * angles: an array of all angles to appear on the hint path
 *  */
Piechart.prototype.selectSegment = function (id,angles,start){
    var ref = this;

    //In case next view went out of bounds (from snapping to view), re-adjust the view variables
    var drawingView = adjustView(this);

    this.timeDirection = 0;  //In case dragging starts at a corner..
    this.dragStartAngle = start; //Important: save the start angle and re-set interpolation
    this.interpValue = 0;
    this.previousDragDirection = (angles[this.nextView]>angles[this.currentView])?1:-1;

    //Search the dataset for ambiguous cases (sequences of stationary bars)
    var ambiguousData = checkAmbiguous(this,angles,this.angleThreshold);
    this.ambiguousSegments = ambiguousData[0];
    this.hintArcInfo = this.processHintPathInfo(angles,drawingView);

    //NOTE: Angle has to be converted to match the svg rotate standard: (offset by 90 deg)
    //http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Transforming_the_Coordinate_System#The_rotate_Transformation
    if (this.isAmbiguous ==1 ){ //Draw interaction paths (if any)
        this.interactionPaths = [];
        ambiguousData[1].forEach(function (d){ref.interactionPaths.push(ref.calculatePathPoints(d))});
        this.drawInteractionPaths(angles);
    }

    if (this.hintPathType ==0){
        this.drawHintPath(id,drawingView);
    }else{
        var arcs = this.createArcString(this.hintArcInfo,true);
        drawSmallHintPath(this,0,arcs,false);
    }
}
/**Displays the hint path for the dragged segment
 * */
Piechart.prototype.drawHintPath = function (id,view){
    var ref = this;
    //this.appendAnchor((this.dragStartAngle+angles[drawingView]));
    var hintPathArcString = this.createArcString(this.hintArcInfo,false);

    //Render white path under the main hint path
    this.svg.select("#hintPath").append("path")
        .attr("d", hintPathArcString)
        .attr("id","pathUnderlayer").attr("class","path")
		.style("stroke-width",7).style("stroke","#FFF").style("fill","none")
        .attr("filter", function (){return (ref.useMobile)?"":"url(#blur)"});

    //Render the hint path
    this.svg.select("#hintPath").append("path")
        .attr("d", hintPathArcString)
        .attr("id","path").attr("class","path")
		.style("stroke-width",2).style("stroke","#969696").style("fill","none")
        .attr("filter", function (){return (ref.useMobile)?"":"url(#blur)"});

    if (this.useMobile){ //Adjust the display properties of the hint path
       drawMobileHintPath(this);
    }
    /**var drawLine = d3.svg.line().interpolate("cardinal");
    var testPoints = this.calculateHintPathPoints(this.hintArcInfo);

    this.svg.select("#hintPath").append("path")
        //.attr("d", drawLine(this.hintArcInfo.map(function (d){return [d[0],d[1]]})))
        .attr("d", drawLine(testPoints))
        .attr("id","path")
        .attr("filter", "url(#blur)");*/

	//Render the hint labels
	this.svg.select("#hintPath").selectAll("text")
         .data(this.hintArcInfo.map(function (d,i) {return {x:d[0],y:d[1],id:i}})).enter()
         .append("svg:text").text(function(d) { return ref.labels[d.id]; })
         .attr("transform", function (d){return "translate("+ d.x+","+ d.y+")";})
         .on("click",this.clickHintLabelFunction)
         .style("fill-opacity",function (d){ return ref.changeLabelOpacity(d,view)})
         .attr("id",function (d){return "hintLabel"+ d.id}).attr("class","hintLabels");

   this.hintArcInfo = [];
}
/**Calls the util function to draw a legend on the screen
 * x,y: position of the legend on the screen
 * */
Piechart.prototype.showLegend = function(x,y){
    drawColourLegend(this,this.colours,this.segmentLabels,this.cx+this.radius,y,30,15,1.2);
}
 /** Angle has to be converted to match the svg rotate standard coordinate system: (offset by 90 deg)
 *  source: http://commons.oreilly.com/wiki/index.php/SVG_Essentials/Transforming_the_Coordinate_System#The_rotate_Transformation
*/
Piechart.prototype.convertAngle = function (angle){
    return (angle >=0 && angle < Math.PI/2)? (3*Math.PI/2 + angle):(angle - Math.PI/2);
}
/** Clears the hint path by removing all svg elements in #hintPath */
 Piechart.prototype.clearHintPath = function (){
     //Re-set some global variables
     this.pathData = [];
     this.interactionPaths = [];
     this.isAmbiguous = 0;

     //Clear contents of #hintPath
     //this.removeAnchor();
     this.svg.select("#hintPath").selectAll("text").remove();
     this.svg.select("#hintPath").selectAll("path").remove();
     //this.svg.selectAll(".displayArcs").style("fill-opacity", 1);
 }
/**Calculates the amount to translate the hint path inwards or outwards on the piechart
 * this is really achieved by growing or shrinking the radius of the hint path segments
 * index: the arc index (which arc the hint angle lies on)
 * view: the view index
 * */
Piechart.prototype.findHintRadius = function (index,view){

    var radius = this.labelOffset+this.hintRadiusSpacing*(index-view);
    if (radius <0){ //Remove this section of the hint path (to prevent it from wrapping around to the other side), also remove the label
        this.svg.select("#hintLabel"+index).style("fill","none");
        return 0;
    }
    this.svg.select("#hintLabel"+index).style("fill","#666");
    return radius;
}
/**Interpolates radius between start and end view, used for animating the hint path
 * while a segment is dragged
 * startView,endView: the views to interpolate between
 * index: the arc index (which arc the hint angle lies on)
 * */
Piechart.prototype.interpolateHintRadius = function (index,startView,endView){
    var startRadius = this.findHintRadius(index,startView);
    var endRadius = this.findHintRadius(index,endView);
   // if(index==0) console.log(startRadius+" "+endRadius);
    return this.interpolator(startRadius,endRadius,this.interpValue);
}
/** A function which manually constructs the path string to draw a hint path consisting of arcs
 *  The format of the string is: M startX startY A rX rY 0 0 0 endX endY
 *  Where: startX,startY define the starting point, endX,endY is the ending point
 *         A is the rotation angle, rx,ry is the radius of the arc and the 0's are just unset flags
 *  Good resource: https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
 * */
Piechart.prototype.createArcString = function (pathInfo,isSmallHintPath){
    var dString = "";
    var strings = [];
    var x,y;
    var currentDirection = 1, previousDirection = 1;
    //TODO: doesn't draw properly when angle wraps around 360 deg
    for (var j=0;j<pathInfo.length;j++){
        //Either increasing or decreasing
        if (j>0){
            var x1,y1,x2,y2; //x2,y2 represents the bigger angle
            if (pathInfo[j][3] > pathInfo[j-1][3]){ //compare the angles to see which one is bigger
                currentDirection = 1;
                x1 = pathInfo[j-1][0];
                y1 = pathInfo[j-1][1];
                x2 = pathInfo[j][0];
                y2 = pathInfo[j][1];
            }else{
                currentDirection = 0;
                x1 = pathInfo[j][0];
                y1 = pathInfo[j][1];
                x2 = pathInfo[j-1][0];
                y2 = pathInfo[j-1][1];
            }
            var currentStr = "";
            if (currentDirection != previousDirection){ //Changing directions
                var radiusDiff = Math.abs(pathInfo[j][2] - pathInfo[j-1][2]);
                var coords = this.calculatePolarCoords((pathInfo[j-1][3] -this.halfPi),(pathInfo[j-1][2] + radiusDiff*0.35));
                currentStr = "M "+pathInfo[j-1][0]+" "+pathInfo[j-1][1]+" L "+coords[0]+" "+coords[1]; //Small connecting line which joins two radii
                if (pathInfo[j][3] > pathInfo[j-1][3]){
                    currentStr += "M "+pathInfo[j][0]+" "+pathInfo[j][1]+" A "+pathInfo[j][2]+" "
                        +pathInfo[j][2]+" 0 0 0 "+coords[0]+" "+coords[1];
                }else{
                    currentStr += "M "+coords[0]+" "+coords[1]+" A "+pathInfo[j][2]+" "
                        +pathInfo[j][2]+" 0 0 0 "+pathInfo[j][0]+" "+pathInfo[j][1];
                }
            } else {
                //Always written as bigger to smaller angle to get the correct drawing direction of arc
                currentStr = "M "+x2+" "+y2+" A "+pathInfo[j][2]+" "+pathInfo[j][2]+" 0 0 0 "+x1+" "+y1;
            }

            if (isSmallHintPath){
                strings.push(currentStr);
            }else{
                dString += currentStr;
            }
        }
        previousDirection = currentDirection;
    }

    return (isSmallHintPath)? strings:dString;
}
/** Animates all segments on the piechart along the hint path of a selected segment
 *  startView to endView, this function is called when a label on the hint path is clicked
 *  startView, endView: View indices bounding the animation
 *  id: of the dragged segment (if any)
 *  Tweening based on this example: http://bl.ocks.org/mbostock/1346410
 * */
Piechart.prototype.animateSegments = function(id, startView, endView) {

    if (startView == endView){return;}
    var ref = this;
    //Determine the travel direction (e.g., forward or backward in time)
    var direction = 1;
    if (startView>endView) {direction=-1};

    //Define some counter variables to keep track of the views passed during the transition
    var totalViews = this.numArcs+1;
    var viewCounter = -1; //Identifies when a new view is reached
    var animateView = startView; //Indicates when to switch the views (after all points are finished transitioning)

    var allAngles = this.svg.selectAll(".displayArcs").data().map(function (d){return d.nodes});
    //var savedNodes = this.svg.selectAll(".displayArcs").data().map(function (d){return d;});
    var newAngles = allAngles.map(function (k){return k[startView]});
    var savedNodes = [];
    this.svg.selectAll(".displayArcs").each(function (d){savedNodes.push(d)});

    //console.log(allAngles.map(function (k){return 180*k[0]/Math.PI}));
    //Apply multiple transitions to each display point by chaining them
    this.svg.selectAll(".displayArcs").each(animate());

    //Recursively invoke this function to chain transitions, a new transition is added once
    //the current one is finished
    function animate() {
        viewCounter++;
        if (viewCounter==totalViews) {
            animateView = animateView + direction;
            newAngles = allAngles.map(function (k){return k[animateView]});
            //Recalculate the piechart layout at the view
            ref.calculateLayout(newAngles,ref.dragStartAngle,id);
            viewCounter = 0;
        }
        if (direction == 1 && animateView>=endView) return;
        if (direction ==-1 && animateView<=endView) return;

        return function(d) {
            //Redraw the piechart at the new view
            d3.select(this).transition().duration(400)
                .attrTween("d",function (a){
                    a.startAngle = ref.startAngles[a.id];
                    a.endAngle = ref.endAngles[a.id];
                    var interpolator = d3.interpolate(savedNodes[a.id],a);
                    savedNodes[a.id] = interpolator(0);
                    return function (t){
                        return ref.arcGenerator(interpolator(t));
                    }
                })
                .each("end", animate());

            //If a hint path is visible, animate it
            if (d.id == id){

                var hintArcInfo = ref.calculateHintAngles(d.nodes,animateView,0);
                var hintPathArcString = ref.createArcString(hintArcInfo);

                //Redraw the hint path
                d3.selectAll(".path").attr("d", hintPathArcString);

                //Re-draw the hint path labels
                d3.selectAll(".hintLabels").attr("transform",function (a) {
                    return "translate("+hintArcInfo[a.id][0]+","+hintArcInfo[a.id][1]+")";
                }).style("fill-opacity",function (d){return ref.changeLabelOpacity(d,animateView)})
                  .style("fill",this.labelColour);

                //Redraw the interaction path(s) if any
                if (ref.isAmbiguous ==1){
                    d3.selectAll(".interactionPath").attr("d",function (d) {
                        var xTranslate = hintArcInfo[d.view][0];
                        var yTranslate = hintArcInfo[d.view][1];
                        var translatedPoints = d.points.map(function (b){return [b[0]+xTranslate,b[1]+yTranslate]});
                        d3.select(this).attr("transform","rotate("+d.rotationAngle+","+xTranslate+","+yTranslate+")");
                        return ref.interactionPathGenerator(translatedPoints);
                    });
                }
            }
        };
    }
}
/** Calculates a set of points to compose a sine wave (for an interaction path)
 * indices: the corresponding year indices, this array's length is the number of peaks of the path
 * @return an array of points for drawing the sine wave: [[x,y], etc.]
 * */
Piechart.prototype.calculatePathPoints = function (indices){
    var angle = 0;
    var pathPoints = [];

    //Find the period of the sine function
    var length = indices.length;
    var totalPts = 3*length + (length-3);
    var xPos = 0, yPos = 0;
    var k = 0;
    var viewIndex = 0;
    var sign = -1;

    //Calculate the points (5 per gap between views)
    for (var j=0;j<totalPts;j++){
        if (j%4 == 0 && j!==(totalPts-1)){ //Crossing the axis of the sine wave (at a view point)
          viewIndex = indices[k];
          xPos = this.hintArcInfo[viewIndex][0];
          yPos = this.hintArcInfo[viewIndex][1];
          this.ambiguousSegments[viewIndex].push(sign); //Add the sign (+1 for peak, -1 for trough) to each ambiguous segment along the sine wave
          sign = (sign==-1)?1:-1; //Flip the sign of the sine wave direction
          k++;
        }
        var theta = angle + (Math.PI/4)*j;
        var y = this.amplitudeHeight*Math.sin(theta);
        var x = (this.hintRadiusSpacing/4)*j;

        pathPoints.push([x,y,xPos,yPos]);
    }

    //Insert the direction of the end point on the sine wave into ambiguousSegments array
    var endDirection = (indices.length % 2==0)?-1:1;
    this.ambiguousSegments[indices[indices.length-1]].push(endDirection);

    return [pathPoints,indices[0]];
}
/** Draws interaction paths as sine waves with a dashed line, also sets the passedMiddle variable
 *  translateX,Y: the amount to translate the path by initially
 * */
Piechart.prototype.drawInteractionPaths = function(angles){
    var ref = this;

    this.svg.select("#hintPath").selectAll(".interactionPath")
        .data(this.interactionPaths.map(function (d,i) {
        var viewIndex = d[1];
        var angle_deg = ref.convertAngle((angles[viewIndex]+ref.dragStartAngle))*(180/Math.PI);
        return {points:d[0],id:i,rotationAngle:angle_deg,view:viewIndex}
    })).enter().append("path").attr("class","interactionPath")
        .attr("d",function (d) {
            //Translate the sine wave to it's stationary angle
            var xTranslate = ref.hintArcInfo[d.view][0];
            var yTranslate = ref.hintArcInfo[d.view][1];
            var translatedPoints = d.points.map(function (b){return [b[0]+xTranslate,b[1]+yTranslate]});

            d3.select(this).attr("transform","rotate("+d.rotationAngle+","+xTranslate+","+yTranslate+")"); //Transform the node in this function so data doesn't have to be saved...

            return ref.interactionPathGenerator(translatedPoints);
        });
    this.passedMiddle = -1; //In case dragging has started in the middle of a sine wave..
}