// commented by mauckc on 20181013
var Neuvol;
var game;
var FPS = 60;

var nbSensors = 16;
var maxSensorSize = 256;

var images = {};

var framesTimeoutThreshold = 1000;

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive 
}

// timeout listener setup
(function() {
	var timeouts = [];
	var messageName = "zero-timeout-message";

        // Like setTimeout, but only takes a function argument.  There's
        // no time argument (always zero) and no arguments (you have to
        // use a closure).
function setZeroTimeout(fn) {
	timeouts.push(fn);
	window.postMessage(messageName, "*");
}

function handleMessage(event) {
	if (event.source == window && event.data == messageName) {
		event.stopPropagation();
		if (timeouts.length > 0) {
			var fn = timeouts.shift();
			fn();
		}
	}
}

window.addEventListener("message", handleMessage, true);

        // Add the one thing we want added to the window object.
        window.setZeroTimeout = setZeroTimeout;
    })();
// End timeout listener setup

// box collision check
var collisionAABB = function(obj1, obj2){
  if(!(obj1.x > obj2.x + obj2.width || obj1.x + obj1.width < obj2.x || obj1.y > obj2.y + obj2.height || obj1.y + obj1.height < obj2.y)){
    return true;
  }
  return false;
}

// compute collision on specific segments
var collisionSegments = function(l1x1, l1y1, l1x2, l1y2, l2x1, l2y1, l2x2, l2y2) {
  var denominator = ((l2y2 - l2y1) * (l1x2 - l1x1)) - ((l2x2 - l2x1) * (l1y2 - l1y1));
  if (denominator == 0) {
    return false;
  }
  var a = l1y1 - l2y1;
  var b = l1x1 - l2x1;
  var numerator1 = ((l2x2 - l2x1) * a) - ((l2y2 - l2y1) * b);
  var numerator2 = ((l1x2 - l1x1) * a) - ((l1y2 - l1y1) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  var x = l1x1 + (a * (l1x2 - l1x1));
  var y = l1y1 + (a * (l1y2 - l1y1));
  if (a > 0 && a < 1 && b > 0 && b < 1) {
    return Math.sqrt(Math.pow(x - l1x1, 2) + Math.pow(y - l1y1, 2));
  }
  return false;
};
// check where collision happens along segment using AABB bounding box method
var collisionSegmentAABB = function(x1, y1, x2, y2, ax, ay, aw, ah){
  var distance = 999999;
  var d = [];
  d.push(collisionSegments(x1, y1, x2, y2, ax, ay, ax + aw, ay));
  d.push(collisionSegments(x1, y1, x2, y2, ax, ay, ax, ay + ah));
  d.push(collisionSegments(x1, y1, x2, y2, ax + aw, ay,  ax + aw, ay + ah));
  d.push(collisionSegments(x1, y1, x2, y2, ax, ay + ah,  ax + aw, ay + ah));

  for(var i in d){
    if(d[i] !== false && d[i] < distance){
      distance = d[i];
    }
  }

  return distance;
}
// compute speed
var speed = function(fps){
  FPS = parseInt(fps);
}
// Load image assets
var loadImages = function(sources, callback){
  var nb = 0;
  var loaded = 0;
  var imgs = {};
  for(var i in sources){
    nb++;
    imgs[i] = new Image();
    imgs[i].src = sources[i];
    imgs[i].onload = function(){
      loaded++;
      if(loaded == nb){
        callback(imgs);
      }
    }
  }
}

// Snake class constructor
var Snake = function(json){
  this.width = 30;
  this.height = 30;
  this.x = game.width/2 - this.width/2;
  this.y = game.height/2 - this.height/2;

  this.direction = 0;
  this.movex = 0;
  this.movey = 0;
  this.sens = 1;
  this.vx = getRandomIntInclusive(-10,10)/10;
  this.vy = getRandomIntInclusive(-10,10)/10;

  this.speed = 1.0;
  this.rotationSpeed = 0.003;

  this.alive = true;

  this.init(json);
}
// initialization of the Ship class
Snake.prototype.init = function(json){
  // read entire json for each ship
  for(var i in json){
    this[i] = json[i];
  }
}
// Compute Sensor Distances
Snake.prototype.getSensorDistances = function(){
  var sensors = []; // initialize sensor array
  for(var i = 0; i < nbSensors; i++){
    sensors.push(1);// Create nbSensors number of sensors
  }
  // get distance from ship to all other enemies
  for(var i in game.enemies){
    // get distance cartesian distance (pythagorean theorem)
    var distance = Math.sqrt( Math.pow(game.enemies[i].x + game.enemies[i].width/2 - this.x + this.width/2, 2) + Math.pow(game.enemies[i].y + game.enemies[i].height/2 - this.y + this.height/2, 2));
    if(distance <= maxSensorSize){ // update sensor distances based on enemy collisions
      for(var j = 0; j < nbSensors; j++){
        var x1 = this.x + this.width/2;
        var y1 = this.y + this.height/2;
        var x2 = x1 + Math.cos(Math.PI * 2 / nbSensors * j + this.direction) * maxSensorSize;
        var y2 = y1 + Math.sin(Math.PI * 2/ nbSensors * j + this.direction) * maxSensorSize;

        // Get boundaries of the current enemy
        var objx = game.enemies[i].x + game.enemies[i].width/2;
        var objy = game.enemies[i].y + game.enemies[i].height/2;

        // compute the collisionSegement distance
        if(Math.abs(Math.atan2(objy - y1, objx - x1) - Math.atan2(y2 - y1, x2 - x1)) <= Math.PI * 2 / nbSensors){
          var d = collisionSegmentAABB(x1, y1, x2, y2, game.enemies[i].x, game.enemies[i].y, game.enemies[i].width, game.enemies[i].height);
          if(d/maxSensorSize < sensors[j]){ // If distance is less than sensor distance
            sensors[j] = d/maxSensorSize; // Update sensor size
          }		
        }
      }
    }
  }
// Checks if sensing boundaries
//   for(var j = 0; j < nbSensors; j++){
//     var x1 = this.x + this.width/2;
//     var y1 = this.y + this.height/2;
//     var x2 = x1 + Math.cos(Math.PI / nbSensors * j + this.direction) * maxSensorSize;
//     var y2 = y1 + Math.sin(Math.PI / nbSensors * j + this.direction) * maxSensorSize;

//     var d = collisionSegmentAABB(x1, y1, x2, y2, 0, 0, game.width, game.height);
//     if(d/maxSensorSize < sensors[j]){
//       sensors[j] = d/maxSensorSize;
//     }
//   }

  return sensors;
}

Snake.prototype.update = function(){ //Periodic Boundary check
    // if(this.x < -this.width || this.x  > game.width + this.width){
    //   if (this.x <= -this.width){
    //     this.x = game.width - this.width;
    //   }else{
    //     this.x = 0;
    //   }
    // }
    if(this.x < 0 || this.x  > game.width + this.width){
      this.y = game.height - this.y+this.height*4
      if (this.x <= 0){
        this.x = game.width - this.width*4;
      }else{
        this.x = this.width*4;
      }
    }
    // Check with top and bottom
    if(this.y < 0 || this.y  > game.height + this.height){
      this.x = game.width - this.x+this.width*4
      if (this.y <= 0){
        this.y = game.height - this.height*4;
      } else{
        this.y = this.height*4;
      }
    }
    // Make direction in way of travel 
    var p1 = {
      x: this.x,
      y: this.y
    };

    var p2 = {
      x: this.x + this.movex,
      y: this.y + this.movey
    };

    // angle in radians
    var angleRadians = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    this.direction = angleRadians
    // Update direction
    // this.direction += this.sens * this.rotationSpeed;  

    // Move if network decides
    this.x += this.movex * this.speed;
    this.y += this.movey * this.speed;
  
//     // Update there velocity if they decide to move
// 	  this.vx = this.vx * this.movex;
// 	  this.vy = this.vy * this.movey;
// 	  // this.x += this.vx * this.speed;
// 	  // this.y += this.vy * this.speed;
  
//     if (this.movex > 0){
//       this.vx = 1;
    
//     }else if(this.movex < 0){
//       this.vx = -1;
//     }
//     if (this.movey > 0){
//       this.vy = 1;
    
//     }else if(this.movey < 0){
//       this.vy = -1;
//     }
  
//     this.vx = (this.vx * 0.80 ); //- abs(this.movex * this.vx * 0.75)
//     this.vy = (this.vy * 0.80 ); //- abs(this.movey * this.vy * 0.75)
  
    // Simulate a mimimum brownian motion
    this.x += getRandomIntInclusive(-3,3)/6;
    this.y += getRandomIntInclusive(-3,3)/6;
}

// Check if ship is dead ( boundaries or box collision with any enemy
Snake.prototype.isDead = function(){
  // // Removed for periodic boundaries to take over
  // // Check side to side
  // if(this.x < -this.width || this.x  > game.width + this.width){
  //   return true;
  // }
  // // Check with top and bottom
  // if(this.y < -this.height || this.y  > game.height + this.height){
  //   return true;
  // }
  // Check with all enemies
  for(var i in game.enemies){
    if(collisionAABB(this, game.enemies[i])){
      return true;
    }
  }
  return false;
}

// Enemy constructor
var Enemy = function(json){
	this.x = 0;
	this.y = 0;
	this.width = 100;
	this.height = 100;

	this.speed = 1;

	this.vx = Math.random() * (Math.random() < 0.5 ? 1 : -1);
	this.vy = (1 - Math.abs(this.vx)) * (Math.random() < 0.5 ? 1 : -1);

	this.init(json);
}

Enemy.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

// Update enemies based on position and velocity in x and y
Enemy.prototype.update = function(){
  // Update x velocity
	if(this.x + this.width*2 < 0 || this.x - this.width*2 > game.width){
		this.vx *= -1;
	}
  // Update x velocity
	if(this.y + this.height*2 < 0 || this.y - this.height*2 > game.height){
		this.vy *= -1;
	}
  // Update x and y positions
	this.x += this.vx * this.speed;
	this.y += this.vy * this.speed;
}


// Constructor for Game class
var Game = function(){
	this.enemies = [];
	this.snakes = [];

	this.score = 0;

	this.canvas = document.querySelector("#enemies");
	this.ctx = this.canvas.getContext("2d");
	this.width = this.canvas.width;
	this.height = this.canvas.height;

	this.spawnInterval = 120;
	this.interval = 0;
	this.maxEnemies = 10;

	this.gen = [];

	this.alives = 0;
	this.generation = 0;
}

// Start the game
Game.prototype.start = function(){
	this.interval = 0;
	this.score = 0;
	this.enemies = [];
	this.snakes = [];

	this.gen = Neuvol.nextGeneration();
	for(var i in this.gen){
		var s = new Snake();
		this.snakes.push(s);
	}
	this.generation++;
	this.alives = this.snakes.length;
}

// Update the game
Game.prototype.update = function(){
	for(var i in this.snakes){ // Do for every snakes
		if(this.snakes[i].alive){ // Check if snakes is alive
			var inputs = this.snakes[i].getSensorDistances(); // load inputs from sensors
			var res = this.gen[i].compute(inputs); // compute result?
			this.snakes[i].movex = 0;// initialize the snakes movement in x dir
			this.snakes[i].movey = 0;// initialize the snakes movement in y dir

			if(res[0] > 0.55){// move right
				this.snakes[i].movex++;
			}
			if(res[0] < 0.45){// move left
				this.snakes[i].movex--;
			}

			if(res[1] > 0.55){// move up ( or down? )
				this.snakes[i].movey++;
			}
			if(res[1] < 0.45){// move down ( or up? )
				this.snakes[i].movey--;
			}
      // Update all ships
			this.snakes[i].update();
      // Check if any ships have died
			if(this.snakes[i].isDead()){
        // Update the dead ship's alive attribute 
				this.snakes[i].alive = false;
        // Lower the number of alives
				this.alives--;
        // Update this generation with the score 
				Neuvol.networkScore(this.gen[i], this.score);
        // Check if we need to update the loop
				if(this.isItEnd()){
					this.start();
				}
			}

		}
	}
  // Update each Enemy
	for(var i in this.enemies){
		this.enemies[i].update();
	}
  // Spawn more enemies
	if(this.interval == 0 && this.enemies.length < this.maxEnemies){
		this.spawnEnemies();
	}
  // update interval and check with spawninterval
	this.interval++;
	if(this.interval == this.spawnInterval){
		this.interval = 0;
	}
  
	this.score++;
	var self = this;

	if (FPS == 0) {
		setZeroTimeout(function() {
			self.update();
		});
	}
	else { // set to reset by ending generate after time 1000 frames / frames per second
		setTimeout(function(){
			self.update();
		}, framesTimeoutThreshold/FPS);
	}
  
  // Populate the screen
	this.display();
}

// Generate new instances of enemies and push them to their array of objects
Game.prototype.spawnEnemies = function(){
	var spawns = [
	{x:0 + 30, y:0 + 30},
	//{x:0 + 30, y:this.height - 50},
	{x:this.width - 50, y:this.height - 50},
	//{x:this.width - 50, y:0 + 30}
	];
	for(var i in spawns){
		var a = new Enemy({
			x:spawns[i].x,
			y:spawns[i].y,
		});
		this.enemies.push(a);
	}
}

Game.prototype.isItEnd = function(){
  // check if any snake is still alive
	for(var i in this.snakes){
		if(this.snakes[i].alive){
			return false;
		}
	}
	return true;
}

Game.prototype.display = function(){
  // Draw the backround
	this.ctx.clearRect(0, 0, this.width, this.height);
	this.ctx.drawImage(images.background, 0, 0, this.width, this.height);

	for(var i in this.snakes){
		if(this.snakes[i].alive){
      // choose ship sensor color
			this.ctx.strokeStyle = "#4C4B49";
      // compute the sensors
			// for(var j = 0; j < nbSensors; j++){
			// 	var x1 = this.snakes[i].x + this.snakes[i].width/2;
			// 	var y1 = this.snakes[i].y + this.snakes[i].height/2;
			// 	var x2 = x1 + Math.cos(Math.PI * 2 / nbSensors * j + this.snakes[i].direction) * maxSensorSize;
			// 	var y2 = y1 + Math.sin(Math.PI * 2 / nbSensors * j + this.snakes[i].direction) * maxSensorSize;
			// 	// this.ctx.beginPath();
			// 	// this.ctx.moveTo(x1, y1);
			// 	// this.ctx.lineTo(x2, y2);
			// 	// this.ctx.stroke();
			// }
      // Draw bound boxes around the ships
			// this.ctx.strokeStyle = "red";
			// this.ctx.strokeRect(this.snakes[i].x, this.snakes[i].y, this.snakes[i].width, this.snakes[i].height);
      //var snakeAngle = Math.atan2(this.snakes[i].movex, this.snakes[i].movey);
      // this.ctx.rotate((Math.PI / 180) * snakeAngle);
      // this.ctx.save();
      // this.ctx.rotate((Math.PI / 180) * -snakeAngle);
			//this.ctx.drawImage(images.ship, this.snakes[i].x, this.snakes[i].y, this.snakes[i].width, this.snakes[i].height);
      // this.ctx.rotate((Math.PI / 180) * snakeAngle);
      //this.ctx.restore();
      //this.ctx.rotate((Math.PI / 180) * -snakeAngle);
			// // Allow ships to rotate 90 degrees?
			this.ctx.save(); 
			this.ctx.translate(this.snakes[i].x, this.snakes[i].y);
			this.ctx.translate(this.snakes[i].width/2, this.snakes[i].height/2);
			this.ctx.rotate(this.snakes[i].direction + Math.PI/2);
			this.ctx.drawImage(images.ship, -this.snakes[i].width/2, -this.snakes[i].height/2, this.snakes[i].width, this.snakes[i].height);
			this.ctx.restore();
		}
	}
  // Draw bounding boxes around enemies
	// this.ctx.strokeStyle = "yellow";
	for(var i in this.enemies){
		// this.ctx.strokeRect(this.enemies[i].x, this.enemies[i].y, this.enemies[i].width, this.enemies[i].height);
		this.ctx.drawImage(images.asteroid, this.enemies[i].x, this.enemies[i].y, this.enemies[i].width, this.enemies[i].height);
	}
  // Write text in top left of screen (info text)
	this.ctx.fillStyle = "white";
	this.ctx.font="20px Arial";
	this.ctx.fillText("Score : "+this.score, 10, 25);
	this.ctx.fillText("Generation : "+this.generation, 10, 50);
	this.ctx.fillText("Alive : "+this.alives+" / "+Neuvol.options.population, 10, 75);
}

window.onload = function(){
	var sprites = {
		ship:"img/ship.png",
		asteroid:"img/asteroid.png",
		background:"img/fond.png"
	};

	var start = function(){
		Neuvol = new Neuroevolution({
			population:64,
			network:[nbSensors, [9], 2],
			randomBehaviour:0.15,
			mutationRate:0.25, 
			mutationRange:0.35, 
		});
		game = new Game();
		game.start();
		if (FPS == 0) {
			setZeroTimeout(function() {
				game.update();
			});
		}
		else {
			setTimeout(function(){
				game.update();
			}, 1000/FPS);
		}
	}


	loadImages(sprites, function(imgs){
		images = imgs;
		start();
	})

}
