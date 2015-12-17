require.config({
    paths: {
        "embr": "lib/embr/src"
    }
});

 
var GetPano = function(){};
var GetLinks = function (){};
var GetPanoID = function(){};
var GetLinkedDirections = function(){};
var GetDescription = function(){};
var GetLinkedPanoIDs= function(){};

var GoToPanoID= function(){};
var GoToAddress = function (){};
var GoToDirection = function(){};

var MyResize= function(){};


require([
    "embr/core",
    "embr/material",
//    "embr/Arcball",
    "util",
    "sv"
],
function(core, material,  util, sv){

    if(!window.requestAnimationFrame){
        window.requestAnimationFrame = (function(){
            return window.webkitRequestAnimationFrame ||
                   window.mozRequestAnimationFrame    ||
                   window.oRequestAnimationFrame      ||
                   window.msRequestAnimationFrame     ||
                   function(callback, element){
                       window.setTimeout(callback, 1000 / 60);
                   };
        })();
    }

    var start_locations = [
        "o=0,0,0,1&z=1.8&p=35.66009,139.69979", // Shibuya
        "o=0,0,0,1&z=1.591&p=35.69835,139.77119", // Tamagawa Dori, Shibuya
        "o=0,0,0,1&z=1.509&p=-23.61623,-46.59105", // Heliopolis
        "o=0,0,0,1&z=1.453&p=22.28687,114.19123", // Hong Kong Construction
        "o=0,0,0,1&z=1.718&p=22.27834,114.18080", // Hong Kong Burrowington
        "o=0,0,0,1&p=33.93011,-118.28101", // LA 110
        "o=0,0,0,1&z=1.8&p=37.79074,-122.40565", // SF Chinatown
        "o=0,0,0,1&p=40.70911,-74.01057", // NYC Zuccotti
        "o=0,0,0,1&p=35.01639,135.68119", // Kyoto Arashiyama
        "o=1,0,0,0&z=1.487&p=25.03294,121.56471", // Taipei 101
        "o=0,0,0,1&z=1.361&p=23.64225,119.51382", // Siyu Township
        "o=0,0,0,1&z=1.591&p=35.69935,139.77133", // Akihabara
        "o=0,0,0,1&z=1.566&p=35.31670,139.53571", // Nara Daibutsu
        "o=0,0,0,1&z=1.505&mz=18&p=51.50187,-0.11538", // London Leake St
        "o=0,0,0,1&z=1.535&p=36.86184,-5.17948" // Setenil de las Bodegas
    ];


    // Get DOM Elements

    var left = document.getElementById("left")
    ,   right = document.getElementById("right")
    ,   canvas = document.getElementById("gl-canvas")
    ,   code = document.getElementById("code")
    ,   code_text = document.getElementById("code-text")
    ,   code_toggle = document.getElementById("code-toggle")
    ,   mapui = document.getElementById("mapui")
    ,   panoui = document.getElementById("panoui")
    ,   location = document.getElementById("location")
    ,   above = document.getElementById("above")
    ,   below = document.getElementById("below")
    ,   fullwindow_toggle = document.getElementById("fullwindow")
    ,   about = document.getElementById("about")
    ,   about_toggle = document.getElementById("about-toggle")
    ,   about_backdrop = document.getElementById("about-backdrop")
    ,   no_webgl = document.getElementById("no-webgl")
    ;


    // Setup GoogMaps

    var gm = google.maps;

    var gm_subdomains = [ "0", "1", "2", "3" ];
    var stamen_subdomains = [ "", "a.", "b.", "c.", "d." ];
    var maptype_providers = {
        "toner": {
            name: "Toner",
            url: "http://{S}tile.stamen.com/toner/{Z}/{X}/{Y}.png",
            subdomains: stamen_subdomains,
            min_zoom: 0,
            max_zoom: 20
        },
        "streetview": {
            name: "StreetView",
            url: "http://mts{S}.googleapis.com/vt?lyrs=svv|cb_client:apiv3&style=40,18&x={X}&y={Y}&z={Z}&scale=2",
            subdomains: gm_subdomains,
            min_zoom: 2,
            max_zoom: 17
        }
    };

 


    var streetview = new gm.StreetViewService();
    var geocoder = new gm.Geocoder();



    var pano_heading;
    var pending_pano_req;
    function requestPanoData(requestFn){
        if(!pending_pano_req){
            window.setTimeout(function(){
                pending_pano_req.call(pending_pano_req);
            }, 50);
        }
        pending_pano_req = requestFn;
    }
	var lastLocation = 0;
	var lastRadius = 0;
	
	var maxRadius = 7473794;
    function requestPanoDataByLocation(myLocation, myRadius){
		lastLocation = myLocation;
        lastRadius = myRadius;
		console.log("REquesting "+ lastLocation+ ","+lastRadius );
        streetview.getPanorama({location: myLocation, radius: myRadius, source: google.maps.StreetViewSource.OUTDOOR}, onPanoData);
    }
	
    function requestPanoDataById(id, callbackFn){
        requestPanoData(function(){
            streetview.getPanoramaById(id, function(){
                callbackFn.apply(callbackFn, arguments);
                onPanoData.apply(onPanoData, arguments);
            });
        });
    }
    function onPanoData(data, status){
        if(status == gm.StreetViewStatus.OK && loader){
            var pos = data.location.latLng;
            loader.setPano(data, function(){
                pano_heading = util.degreeToRadian(data.tiles.centerHeading);
                //location.value = data.location.description.trim();
            });
            updateHash();
        }else{
			console.log("return value not ok for onpano data.  i suggest we expand the search ");
			if(lastRadius<maxRadius){
				console.log("expanding "+lastLocation.lat()+ ","+lastLocation.lng()+" : "+lastRadius );
				requestPanoDataByLocation(lastLocation,lastRadius+lastRadius);
			}else{
				console.log("Stopping");
			}
		}
        pending_pano_req = null;
    }


    // Setup Dynamic Code Compilation

    var pano_shader_src_vert = [
        "uniform mat4 projection;",
        "attribute vec3 position;",
        "attribute vec2 texcoord;",
        "varying vec2 v_texcoord;",
        "void main(){",
            "v_texcoord = texcoord;",
            "gl_Position = projection * vec4(position, 1.);",
        "}"
    ].join("\n");
    var pano_shader_src_frag_initial = code_text.value.trim();


    function tryShaderCompile(){
        try{
            pano_shader.compile(pano_shader_src_vert, code_text.value);
            pano_shader.link();
            code_text.classList.remove("error");

            console.log("Compile Successful!");

            var src_frag = code_text.value.trim();
         
        }
        catch(err){
            code_text.classList.add("error");
            console.error("Error compiling shader: " + err);
        }
    }



    // Replacement Map Zoom (can't disable just arrow keys)

    // Mouse Wheel Pano Zoom

    util.addMouseWheelListener(canvas, function(e){
        pano_zoom_goal = core.math.clamp(pano_zoom - e.delta * 0.0333, 0.5, 10);
        updateHash();
    });
    var pano_zoom = 1.8;
    var pano_zoom_goal = pano_zoom;



    var pano_orientation = core.Quat.identity();
	


    // Fullwindow

    function resize(){
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;



    }
    window.addEventListener("resize", resize, false);
	
    function searchAddress(address, callback){
        geocoder.geocode({ address: address }, function(res, status){
            if(status == gm.GeocoderStatus.OK){
                callback(res[0].geometry.location);
            }else{
				
				console.log("Couldn't find address " + address + "->" +address.length);
				GoToPanoID(address);
			}
        });
    }
	
	
    // Setup Keyboard Driving

    document.addEventListener("keydown", function(e){
        if(loader && loader.getPano() && e.keyCode >= 37 && e.keyCode <= 40){
            var key_heading = (e.keyCode - 38) * (Math.PI / 2);
            var best_link, best_angle = Number.MAX_VALUE, angle;
            loader.getPano().links.forEach(function(link){
                angle = util.angleBetween(key_heading, util.degreeToRadian(link.heading));
                if(angle < Math.PI / 2 && angle < best_angle){
                    best_link = link;
                    best_angle = angle;
                }
            });
            if(best_link){
                GoToPanoID(best_link.pano);
            }
        }
    }, false);


    function updateHash(){
        var params = {
//            "z": util.formatNumber(pano_zoom_goal, 3),
        };
        var loc;
        if(loader && loader.getPano() && (loc = loader.getPano().location)){
            params["p"] = [
                loc.latLng.lat().toFixed(5),
                loc.latLng.lng().toFixed(5)
            ];
        }
        document.location.hash = util.stringifyParams(params);
    }
    function loadHash(){
        var params = util.parseUrlHash(document.location.hash);
        if(params.o && params.o.length === 4){
            pano_orientation.setQuat(pano_orientation);
        }
        if(params.p && params.p.length === 2){
            var loc = new gm.LatLng(parseFloat(params.p[0]), parseFloat(params.p[1]));
            if(!isNaN(loc.lat()) && !isNaN(loc.lat())){
                load_hash_pano_fetched = true;
            }
        }
    }
    var load_hash_pano_fetched = false;


    // Loop

    function refresh(){
        window.requestAnimationFrame(draw);
    }

    function draw(){
        refresh();

        var time = (Date.now() - start_time) / 1000;

        gl.viewport(0, 0, canvas.width, canvas.height);

        loader.framebuffer.bindTexture(0);
        pano_zoom = core.math.lerp(pano_zoom, pano_zoom_goal, 0.33);
//        pano_orientation.slerp(arcball.orientation, 0.33).normalize();
        pano_shader.use({
            projection: projection,
            aspect: canvas.height / canvas.width,
            scale: Math.pow(pano_zoom, 3),
            transform: pano_orientation.toMat4().mul(new core.Mat4().rotate(pano_heading + Math.PI *2.0/ 2.0, 0,0,1)),
            time: time,
            texture: 0
        });
        plane.draw(pano_shader);
    }
    var start_time = Date.now();


    // Setup GL

    var modelview = new core.Mat4();
    var projection = new core.Mat4().ortho(0, 1, 1, 0, -1, 1);

    // var gl = core.Util.glWrapContextWithErrorChecks(util.getGLContext(canvas));
    var gl = util.getGLContext(canvas);
    if(gl){
        var pano_shader = new core.Program(gl);
        var plane = core.Vbo.createPlane(gl, 0, 0, 1, 1);

        var loader = new sv.TileLoader(gl);

        tryShaderCompile();

        // Start Loop
        refresh();

        // Show Canvas
        canvas.style.display = "block";
    }
    else {
        // Show No-Webgl Error
        no_webgl.style.display = "block";
    }


    // Load Parameters from Hash

    if(document.location.hash)
        loadHash();
    if(!load_hash_pano_fetched){
        document.location.hash = start_locations[core.math.randInt(start_locations.length)];
        loadHash();
    }


	GetLinks = function(dir){
		if(loader && loader.getPano()){
			return loader.getPano().links;
		}
	}
	
	GetLinkedDirections = function(dir){
		var directions = [];		
			if(loader && loader.getPano()){
				loader.getPano().links.forEach(function(link){
					//console.log(link);
					directions.push(link.heading)
				});
        }
		return directions;
	}

	GetLinkedPanoIDs = function(dir){
		var linked = [];		
			if(loader && loader.getPano()){
				loader.getPano().links.forEach(function(link){
					linked.push(link.pano)
				});
        }
		return linked;
	}

	
	GetPanoID = function (){
		if(loader && loader.getPano()&& loader.getPano().location){
			return loader.getPano().location.pano;
		}
	}
	
	GetPano = function (){
		if(loader && loader.getPano()){
			return loader.getPano();
		}
	}
	
	GetDescription =  function (){
		if(loader && loader.getPano()&& loader.getPano().location){
			return loader.getPano().location.description;
		}
	}

	GoToPanoID = function(id){
		console.log("requestPanoDataById "+id);
		requestPanoDataById(id, function(loc){
			// console.log("requestPanoDataById "+loc.lat()+ " , "+loc.lng());
			// requestPanoDataByLocation(loc,50);
			});
		};
	GoToAddress = function(address){
		console.log("searchAddress "+address);
		searchAddress(address, function(loc){
			console.log("requestPanoDataByLocation "+loc.lat()+ " , "+loc.lng());
			requestPanoDataByLocation(loc,50);
			});
		};
		
	GoToDirection = function(dir){
		if(loader && loader.getPano()){
            var key_heading = dir;
            var best_link, best_angle = Number.MAX_VALUE, angle;
            loader.getPano().links.forEach(function(link){
                angle = util.angleBetween(util.degreeToRadian(key_heading), util.degreeToRadian(link.heading));
                if(angle <  best_angle){
                    best_link = link;
                    best_angle = angle;
                }
            });
            if(best_link){
                GoToPanoID(best_link.pano);
            }
        }
	}
	
	
	MyResize = resize;
	MyResize();
});
