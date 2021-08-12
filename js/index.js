///////////////////////////////////////////
// Initialize Firebase
// different configs
defaults =
    {
        move_closest: false,
        low_confidence: false,
        high_confidence: false,
        suggestions: false,
        image_size: 600,
        invisible_joints_color: "white",
        num_cameras: 1,
        draw_circle: false,
        draw_annotation: true,
        step_size: 1,
        draw_low_confidence: false,
        uid: null,
        ext: ".jpg"
    };


var config_dict =
    {
        "fly_7":
            {
  		apiKey: "AIzaSyBzlim4SdbiWBIIVbXI4-5OL1sDQzvY2_Q",
  		authDomain: "deepfly3d-annotations.firebaseapp.com",
  		databaseURL: "https://deepfly3d-annotations-default-rtdb.firebaseio.com",
  		projectId: "deepfly3d-annotations",
  		storageBucket: "deepfly3d-annotations.appspot.com",
  		messagingSenderId: "375908993801",
  		appId: "1:375908993801:web:09388b5bf69d23d67761d8",
  		measurementId: "G-7P71XPCQLL",

                move_closest: false,
                suggestions: true,
                image_size: 900,
                invisible_joints_color: "blue",
                draw_annotation: true,
                draw_circle: true,

                num_cameras: 7,
                num_images: {
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_001_Beh_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_001_Glue_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_002_Glue_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_003_Beh_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_004_Beh_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_005_Beh_behData_images": 2700*7,
                    "210727_aJO-GAL4xUAS-CsChr_Fly001_006_Beh_behData_images": 2700*7,
                },

                //                0               1        2                3                 4           5             6                7          8
                limb_names: ["Right Frontal", "Right Mid", "Right Back", "Left Frontal", "Left Mid", "Left Back", "Right Antenna", "Left Antenna", "Abdomen"],
                part_names: ["Body-Coxa (Hip)", "Coxa-Femur", "Femur-Tibia ('knee')", "Tibia-Tarsus ('ankle')", "Tarsus tip ('foot tip')"],
                antenna_part_names: ["Antenna Tip"],
                bones: [[0, 1], [1, 2], [2, 3], [3, 4]],
                camera_visible_limbs: [[3, 4, 5, 8], [3, 4, 5, 7, 8], [3, 4, 5, 7], [0, 1, 3, 4, 6, 7], [0, 1, 2, 6], [0, 1, 2, 6, 8], [0, 1, 2, 8]]
        }
    };

// set config
var url_parsed = parseURL();
default_config = "fly_7";
config_name = "config" in url_parsed ? url_parsed["config"] : default_config;
var config = config_dict[config_name];
///////////////////////////////////////////
// set defaults
for (k in defaults) {
    if (!(k in config)) {
        config[k] = defaults[k];
    }
}
if ("ss" in url_parsed) {
    config["step_size"] = parseInt(url_parsed["ss"]);
}
if ("si" in url_parsed) {
    config["session_id"] = url_parsed["si"];
}

if (!(url_parsed["folder"] in config["num_images"])) {
    config["num_images"][url_parsed["folder"]] = 9999;
}
///////////////////////////////////////////
// init the pull-down bar
var limb_names = config["limb_names"];
var part_names = config["part_names"];
var bones = config["bones"];
///////////////////////////////////////////                                                                                                                                                                  
// undo and redo caches                                                                                                                                                                                      
var undo_cache = []; // stack                                                                                                                                                                                
var redo_cache = []; // stack                                                                                                                                                                                
var pose_change_cache = true; // whether next or previous                                                                                                                                                     
console.log("pose change cache " + pose_change_cache);

function cache_push(cache, selected_point_id, pos) {
    if (annotation_positions[selected_point_id] != []) {
        cache.push({
            selected_point_id: selected_point_id,
            selected_point: pos
        });
    }
}

function empty_cache(cache) {
    while (cache.length) {
        cache.pop();
    }
}

function cache_pop(cache) {
    if (cache.length > 0) {
        d = cache.pop();
        // console.log(d);                                                                                                                                                                                    
        past_state = {
            "selected_point_id": d["selected_point_id"],
            "selected_point": annotation_positions[d["selected_point_id"]]
        };
        set_selected_point_id(d["selected_point_id"]);
        set_annotation_point(selected_point_id, d["selected_point"]);

        update_image();
        return past_state;
    } else {
        return {};
    }
}

///////////////////////////////////////////
// init firebase
firebase.initializeApp(config);
firebase.auth().signInAnonymously().then(function (error) {
    read_new_position_async(frame_counter);
});
///////////////////////////////////////////
// Initialize core variables and fields
var frame_counter = 0;
frame_counter = init_frames();
var image_shape = [config["image_size"], 0]; // second value to be overwritten by the read image ratio
///////////////////////////////////////////
// init pulldown
var select_limb = document.getElementById('select_limb');
var select_part = document.getElementById('select_part');
init_pull_down(select_limb, limb_names);
init_pull_down(select_part, part_names);
// init html static fields
update_html_counter();

// init marker positions
var num_points = limb_names.length * part_names.length;
var selected_point_id = 0;
var annotation_positions = []; // Note, stored in normalized image coordinates (0..1)
var next_annotation_positions = [];
zero_annotations();

// change selected joint
select_first_visible_joint();
// or annotated currently by the user
var is_current_image_annotation_suggestion = false;

///////////////////////////////////////////
// Helper function
function init_pull_down(menu, names) {
    if (names.length == config["limb_names"].length) {
        init_pull_down_limbs();
    }
    else {
        init_pull_down_joints();
    }
}

function init_pull_down_limbs() {
    camera_id = get_camera_id(frame_counter);
    clear_menu(select_limb);
    /*
    for (var i = 0; i < config["camera_visible_limbs"][camera_id].length; i++) {
        var option = document.createElement('option');
        option.value = i;
        option.text = names[config["camera_visible_limbs"][camera_id][i]];
        menu.add(option, 0);
    }
    */

    for (var i = 0; i < limb_names.length; i++) {
        var option = document.createElement('option');
        option.value = i;
        option.text = limb_names[i];
        select_limb.add(option, 0);
    }

}

function init_pull_down_joints(menu, names) {
    clear_menu(select_part);
    if (!(is_limb_antenna(get_limb_id()))) {
        for (i = 0; i < part_names.length; i++) {
            var option = document.createElement('option');
            option.value = i;
            option.text = part_names[i];
            select_part.add(option, 0);
        }
    }
    else {
        for (i = 0; i < config["antenna_part_names"].length; i++) {
            var option = document.createElement('option');
            option.value = i;
            option.text = config["antenna_part_names"][i];
            select_part.add(option, 0);
        }
    }
}

function clear_menu(menu) {
    while (menu.options.length > 0) {
        menu.remove(0);
    }
}

function zero_annotations() {
    for (i = 0; i < num_points; i++) {
        annotation_positions[i] = [0, 0];
    }
}

// TODO add reading from the folder to create the frames
function init_frames() {
    dict = parseURL();
    /*
    if (dict["frames"][0] == "[") // list of frames?
    {
        frame_list_new = dict["frames"].replace("[", "").replace("]", "").split(",")
        for (var i = 0; i < frame_list_new.length; i++) {
            frame_list_new[i] = parseInt(frame_list_new[i], 0);
        }
    } else if (dict["frames"][0] == "s") { // then sXeY format where X is the starting frame and Y is the last frame
	console.log("here");
        dict["frames"] = dict["frames"].replace("s","").replace("e",",").split(",")
        start = parseInt(dict["frames"][0])
        end = parseInt(dict["frames"][1])
        frame_list_new = [...Array(1+end-start).keys()].map(v => start+v)
	console.log(frame_list_new);
    }
    else {  // just an integer, which is the end frame
        num_frames = parseInt(dict["frames"])
        frame_list_new = [...Array(num_frames).keys()];
    }

    for (var i = 0; i < frame_list_new.length; i++) {
        frame_list_new[i] = pad_number(frame_list_new[i],6)
    }
    //console.log("frame list" + frame_list_new)
    */

    if (!("frames" in dict)) {
        var new_frame_counter = 0;
    }
    else if (dict["frames"][0] == "s") {
        // console.log("here");
        dict["frames"] = dict["frames"].replace("s", "").replace("e", ",").split(",")
        start = parseInt(dict["frames"][0])
        var new_frame_counter = start;
    }
    return new_frame_counter;
}

/* ide reformat messes up this function */
/*
function init_frames() {
    dict = parseURL();
    if (dict["frames"][0] == "[") // list of frames?
    {
        frame_list_new = dict["frames"].replace("[", "").replace("]", "").split(",")
        for (var i = 0; i < frame_list_new.length; i++) {
            frame_list_new[i] = parseInt(frame_list_new[i], 0);
        }
    } else if (dict["frames"][0] == "s") { // then sXeY format where X is the starting frame and Y is the last frame
        dict["frames"] = dict["frames"].replace("s","").replace("e",",").split(",")
        start = parseInt(dict["frames"][0])
        end = parseInt(dict["frames"][1])
        frame_list_new = [...Array(1+end-start).keys()].map(v => start+v)
    }
    else {  // just an integer, which is the end frame
        num_frames = parseInt(dict["frames"])
        frame_list_new = [...Array(num_frames).keys()];
    }

    for (var i = 0; i < frame_list_new.length; i++) {
        frame_list_new[i] = pad_number(frame_list_new[i],6)
    }
    //console.log("frame list" + frame_list_new)
    return frame_list_new
}
 */

///////////////////////////////////////////
// Drawing
function draw_annotations_on_canvas_async(ctx, image_path, continuation = 0) {
    var img = new Image();
    img.onload = function () {
        // update the image shape
        image_shape[1] = image_shape[0] * img.naturalHeight / img.naturalWidth;
        ctx.canvas.width = image_shape[0];
        ctx.canvas.height = image_shape[1];

        //also adjust the width. NO, this moves the whole page. UNCOMFORTABLE
        //document.getElementById("body").style.maxWidth = image_shape[0]+"px";
        // draw the image as background first
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, image_shape[0], image_shape[1]);

        // outside view area
        if (config["draw_low_confidence"]) {
            var path = new Path2D();
            path.moveTo(0, 0);
            path.lineTo(0.2 * image_shape[0], 0.0 * image_shape[1]);
            path.lineTo(0.0 * image_shape[0], 0.2 * image_shape[1]);
            ctx.fillStyle = config["invisible_joints_color"];
            ctx.fill(path);
            ctx.fillStyle = "black"; // set the stroke color
            ctx.fillText("Invisible joints", 0.02 * image_shape[0], 0.03 * image_shape[1]);
            ctx.font = "60px Verdana";
        }

        // draw existing annotations
        //console.log(annotation_positions);
        if (config["draw_annotation"]) {
            for (var i = 0; i < num_points; i++) {
                if (annotation_positions == undefined || annotation_positions[i][0] == 0 && annotation_positions[i][1] == 0) {
                    continue;
                }

                ctx.strokeStyle = "hsl(" + i * 360 / num_points + ", " + 100 + "%, " + 50 + "%)"; // set the stroke color
                ctx.beginPath();
                var radius = annotation_positions[i][0] > 0 ? 5 : 10;
                ctx.arc(Math.abs(annotation_positions[i][0] * image_shape[0]),
                    Math.abs(annotation_positions[i][1] * image_shape[1]),
                    radius, 0, 2 * Math.PI);
                ctx.stroke();

                // mark center
                ctx.beginPath();
                ctx.arc(Math.abs(annotation_positions[i][0] * image_shape[0]),
                    Math.abs(annotation_positions[i][1] * image_shape[1]),
                    0.1, 0, 2 * Math.PI);
                ctx.stroke();
            }

            // draw bones
            for (var bi = 0; bi < bones.length; bi++) {
                var i = bones[bi][0];
                var j = bones[bi][1];

                // draw bone for every limb
                for (var c = 0; c < config["camera_visible_limbs"][get_camera_id(frame_counter)].length; c++) {
                    limb_id = config["camera_visible_limbs"][get_camera_id(frame_counter)][c];

                    i_ = i + ((limb_id) * part_names.length);
                    j_ = j + ((limb_id) * part_names.length);
                    //console.log(limb_id);
                    //console.log(i_);


                    if (annotation_positions == undefined ||
                        (Math.abs(annotation_positions[i_][0]) <= 0.2 && Math.abs(annotation_positions[i_][1]) <= 0.2 && config["draw_low_confidence"]) ||
                        (Math.abs(annotation_positions[j_][0]) <= 0.2 && Math.abs(annotation_positions[j_][1]) <= 0.2 && config["draw_low_confidence"]) ||
                        (annotation_positions[i_][0] == 0 && annotation_positions[i_][1] == 0) || (annotation_positions[j_][0] == 0 && annotation_positions[j_][1] == 0)) {
                        continue;
                    }

                    ctx.strokeStyle = "hsl(" + i_ * 360 / num_points + ", " + 100 + "%, " + 50 + "%)"; // set the stroke color
                    //ctx.globalAlpha = 0.;
                    ctx.beginPath();
                    ctx.moveTo(Math.abs(annotation_positions[i_][0]) * image_shape[0], Math.abs(annotation_positions[i_][1]) * image_shape[1]);
                    ctx.lineTo(Math.abs(annotation_positions[j_][0]) * image_shape[0], Math.abs(annotation_positions[j_][1]) * image_shape[1]);
                    ctx.stroke();
                }
            }

            // draw circle to show if there are more joints to annotate
            if (config["draw_circle"]) {
                ctx.beginPath();
                offset = 25;
                ctx.arc(image_shape[0] - offset, offset, offset, 0, 2 * Math.PI, true);

                if (current_image_annotation_suggestion()) {
                    ctx.fillStyle = 'yellow';
                }
                else if (current_image_annotation_complete()) {
                    ctx.fillStyle = 'green';
                }
                else {
                    ctx.fillStyle = 'red';
                }
                ctx.fill();
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#003300';
                ctx.stroke();
            }
        }

        // draw epipolar lines
        /*
        if (get_camera_id(frame_counter) == 0 && next_annotation_positions[0]!=undefined){
            jid = selected_point_id;
            console.log("jid " + jid)
            cor = [Math.abs(next_annotation_positions[jid][0])*480, Math.abs(next_annotation_positions[jid][1])*800];
            console.log("cor:" + cor);
            var hom_point = [cor[0], cor[1], 1];
            console.log("hom point:" + hom_point);
            fund_mat = config["fund_mat"];

            hom_line = [0,0,0]
            hom_line[0] = fund_mat[0][0]*hom_point[0] + fund_mat[0][1]*hom_point[1] + fund_mat[0][2]*hom_point[2];
            hom_line[1]= fund_mat[1][0]*hom_point[0] + fund_mat[1][1]*hom_point[1] + fund_mat[1][2]*hom_point[2];
            hom_line[2]= fund_mat[2][0]*hom_point[0] + fund_mat[2][1]*hom_point[1] + fund_mat[2][2]*hom_point[2];

            console.log(hom_line);
            // y when x=0 or x=max
            //if (-hom_line[2]/hom_line[1] > 0 && -hom_line[2]/hom_line[1] < 1){
            first_point = [0, -hom_line[2]/hom_line[1]]
            //}
            //else{
            second_point = [480,(-hom_line[2]-480*hom_line[0])/hom_line[1]]
         //   }

            // x when y=0 or y=max
             // console.log(-hom_line[2]/hom_line[0]);
            //if (-hom_line[2]/hom_line[0] > 0 && -hom_line[2]/hom_line[0] < 1){

    //		second_point = [0, -hom_line[2]/hom_line[0]]
            //}
            //else{
        //	second_point = [1,(-hom_line[2]-hom_line[1])/hom_line[0]]
            //}
            first_point = [first_point[0]/480, first_point[1]/800];
            second_point = [second_point[0]/480, second_point[1]/800];

            ctx.strokeStyle = "hsl(" + jid * 360 / num_points + ", " + 100 + "%, " + 50 + "%)"; // set the stroke color
            ctx.beginPath();
            ctx.moveTo(first_point[0]* image_shape[0], first_point[1] * image_shape[1]);
            ctx.lineTo(second_point[0] * image_shape[0], second_point[1] * image_shape[1]);
            ctx.lineWidth=2;
            ctx.stroke();

            console.log(first_point);
            console.log(second_point);
        }
    */

        if (continuation) {
            continuation();
        }
    };

    if (!imageExists(image_path) && get_camera_id(frame_counter) != 3) {
        if (pose_change_cache) { // if the last pose change was +1
            next_pose();
        }
        else { // if it was -1
            previous_pose();
        }
    }
    else {
        img.src = image_path;
    }
}

function mat_multiply(a, b) {
    var aNumRows = a.length, aNumCols = a[0].length,
        bNumRows = b.length, bNumCols = b[0].length,
        m = new Array(aNumRows);  // initialize array of rows
    for (var r = 0; r < aNumRows; ++r) {
        m[r] = new Array(bNumCols); // initialize the current row
        for (var c = 0; c < bNumCols; ++c) {
            m[r][c] = 0;             // initialize the current cell
            for (var i = 0; i < aNumCols; ++i) {
                m[r][c] += a[r][i] * b[i][c];
            }
        }
    }
    return m;
}

///////////////////////////////////////////
// Naming conventions
function parseURL() {
    url = decodeURI(window.location.href)
    uri = url.split('?')[1];
    assignments = uri.split('+');
    var dict = {};
    for (var i = 0; i < assignments.length; i++) {
        dict[assignments[i].split('=')[0]] = assignments[i].split('=')[1]
    }
    //console.log(dict)
    return dict;
}

function getImageName(frame_counter) {
    dict = parseURL();
    //counter_padded = frame_list[frame_counter];
    image_path = "data/" + dict["folder"] + "/" + "camera_" + get_camera_id(frame_counter) + "_img_" + ("000000" + get_pose_id(frame_counter)).substr(-6, 6);
    //console.log(image_path)
    return image_path
}

function getNumImages() {
    return config["num_images"][url_parsed["folder"]];
}

function getDatasetName_frame(frame_counter) {
    if (config["session_id"]) {
        //console.log("session  id as  admin");
        return config["session_id"] + "/" + getImageName(frame_counter);
    }
    else {
        //console.log("session  id as  non-admin");
        var user = firebase.auth().currentUser;
        if (user == null)
            return "";
        var uid = user.uid;
        //console.log("frame: " + uid + getImageName(frame_counter));
        config["session_id"] = uid;
        return uid + "/" + getImageName(frame_counter);
    }
}

function getDatasetName_folder(frame_counter) {
    if (config["session_id"]) {
        return config["session_id"];
    }
    else {
        //console.log("session  id as non- admin");
        var user = firebase.auth().currentUser;
        if (user == null)
            return "";
        var uid = user.uid;
        config["session_id"] = uid;
        //console.log(uid);
        return uid
    }
}

function imageExists(image_url) {
    var http = new XMLHttpRequest();

    http.open('HEAD', image_url, false);
    http.send();

    return http.status != 404;
}

///////////////////////////////////////////
// State updates
function update_image() {
    var image_name = getImageName(frame_counter);
    var ext = config["ext"];
    var image_path = image_name + ext;
    //console.log(image_path)
    // get cavas
    var c = document.getElementById("canvas");
    var ctx = c.getContext("2d");

    // update image
    draw_annotations_on_canvas_async(ctx, image_path, function () { // continuation
        // debug info
        document.getElementById("image_name").innerHTML = "Info: " + image_name + ext + ", limb " + parseInt(select_limb.value) + ", joint " + parseInt(select_part.value) + ", frameID " + frame_counter + ", sessionID: '" + getDatasetName_frame(0) + "'";

        // disable loading screen
        document.getElementById("loading_screen").style.display = "none";
        document.getElementById("loading_screen_text").style.display = "none";
        document.getElementById("body").style.display = "block";
    })
}

function update_frame_counter(new_conter) {
    frame_counter = Math.max(0, new_conter);
}

function update_joint_counter(new_id) {
    total_number_of_joints = part_names.length * limb_names.length;
    selected_point_id = (new_id + total_number_of_joints) % total_number_of_joints; // add once to handle negative numbers

    select_limb.value = Math.floor(selected_point_id / part_names.length);
    select_part.value = selected_point_id % part_names.length;
    //console.log(select_part.value);
}

function select_next_visible_limb() {
    // go to next visible joint
    selected_point_id = (selected_point_id + 5) % num_points;
    while (!current_camera_sees_this_joint(selected_point_id)) {
        //console.log("select next joint");
        selected_point_id = (selected_point_id + 5) % num_points;
    }
    update_joint_counter(selected_point_id);
    update_image();
    //console.log("Current joint after select next joint: " + limb_names[get_limb_id()] + " " + get_joint_id());
}

function select_next_visible_joint() {
    // go to next visible joint
    selected_point_id = (selected_point_id + 1) % num_points;
    // WARNING we ignore antenna
    while (!current_camera_sees_this_joint(selected_point_id) || is_limb_antenna(get_limb_id())) {
        //console.log("select next joint");
        selected_point_id = (selected_point_id + 1) % num_points;
    }
    update_joint_counter(selected_point_id);
    update_image();
    //console.log("Current joint after select next joint: " + limb_names[get_limb_id()] + " " + get_joint_id());
}

function select_next_joint() {
    // go to next visible joint
    selected_point_id = (selected_point_id + 1) % num_points;
    // WARNING we ignore antenna
    while (is_limb_antenna(get_limb_id())) {
        //console.log("select next joint");
        selected_point_id = (selected_point_id + 1) % num_points;
    }
    update_joint_counter(selected_point_id);
    update_image();
    //console.log("Current joint after select next joint: " + limb_names[get_limb_id()] + " " + get_joint_id());
}

function select_first_visible_joint() {
    selected_point_id = -1; // because we reuse select_*next*`_joint
    select_next_visible_joint();
}

function select_previous_visible_joint() {
    // go previous visible joint
    selected_point_id = (selected_point_id - 1) % num_points;
    while (!current_camera_sees_this_joint(selected_point_id)) {
        selected_point_id = (selected_point_id - 1) % num_points;
        if (selected_point_id == 0) {
            selected_point_id = num_points - 1;
        }
        console.log(selected_point_id);
    }
    update_joint_counter(selected_point_id);
    update_image();
}

function select_next_unnotated_joint() {
    // if current joint is not-annotated quit
    if ((current_camera_sees_this_joint(selected_point_id) || annotation_positions[selected_point_id][0] == 0)) {
        return
    }

    initial_selected_point_id = selected_point_id; // to prevent infinite search
    // go to next visible joint
    selected_point_id = (selected_point_id + 1) % num_points;
    while ((!current_camera_sees_this_joint(selected_point_id) || annotation_positions[selected_point_id][0] != 0 || is_limb_antenna(get_limb_id())) && selected_point_id != initial_selected_point_id) {
        // console.log("select next joint");
        selected_point_id = (selected_point_id + 1) % num_points;
    }
    update_joint_counter(selected_point_id);
    update_image();
    //console.log("Current joint after select next joint: " + limb_names[get_limb_id()] + " " + get_joint_id());
}

function convert_point_low_conf(pos) {
    return [-1 * Math.abs(pos[0]), -1 * Math.abs(pos[1])]
}

function convert_point_high_conf(pos) {
    return [Math.abs(pos[0]), Math.abs(pos[1])];
}

function current_camera_sees_this_joint() {
    limb_id = get_limb_id();
    joint_id = get_joint_id();
    //console.log("Limb id: " + limb_id);
    // check if limb_id is in visible limbs for current camera
    /*
    for(var i = 0; i<config["camera_visible_limbs"][get_camera_id()].length; i++){
	console.log("This camera sees: " + limb_names[config["camera_visible_limbs"][get_camera_id()][i]]);
    }
    */

    for (var i = 0; i < config["camera_visible_limbs"][get_camera_id(frame_counter)].length; i++) {
        if ((config["camera_visible_limbs"][get_camera_id(frame_counter)][i] == limb_id) && !(limb_id > 5 && joint_id > 0)) {
            //console.log("Limb id " +  limb_names[limb_id]+ " is visible");
            return true;
        }
    }
    return false;
}

function limb_changed() {
    selected_point_id = part_names.length * parseInt(select_limb.value) + parseInt(select_part.value);
    update_image();
}

function update_marker(pos) {
    marker.style.left = pos[0] - (marker.clientHeight / 2) + "px";
    marker.style.top = pos[1] - (marker.clientHeight / 2) + "px";
}

function euc_dist(point1, point2) {
    return Math.sqrt(Math.pow((point1[0] - point2[0]) * image_shape[0], 2) + Math.pow((point1[1] - point2[1]) * image_shape[1], 2));

}

///////////////////////////////////////////
// Cloud i/o

function add_new_point(selected_point_id, pos) {
    annotation_positions[selected_point_id] = pos;
    update_marker(pos);
    is_current_image_annotation_suggestion = false;

    save_new_position_async(annotation_positions, frame_counter);
    save_name();
}

function save_new_position_async(annotation_positions, frame_counter) {
    database_name = getDatasetName_frame(frame_counter);
    if (database_name.length == 0) {
        console.error("database is empty");
    }

    err = firebase.database().ref(database_name).update({
        position: annotation_positions
    });

}

function read_new_position_async(new_counter, continuation = false, continuation_args = [], suggestion_depth=0, depth_limit=3) {
    database_name = getDatasetName_frame(new_counter);
    if (!database_name.length) {
        //console.log("return");
        return;
    }
    empty_cache(undo_cache); // prevent doing undo to previous frames annotations

    quitting = false;
    firebase.database().ref(database_name).once('value').then(function (snapshot) {
        var val = snapshot.val();
        if (val) {
            // console.log("Getting suggestions from frame_id: " + get_previous_pose_id(new_counter));
            annotation_positions = val.position;
            // console.log('read position', new_counter, annotation_positions);

            if (suggestion_depth == 0) {
                is_current_image_annotation_suggestion = false;
            }
            else {
                is_current_image_annotation_suggestion = true;
            }

            quitting = true;
            //          update_image();
        } else if (suggestion_depth < depth_limit && get_pose_id(frame_counter) >= 0) {
            //console.log("no nnotations for frame number " + new_counter);
            zero_annotations();

            //console.log("Getting suggestions from frame_id: " + get_previous_pose_id(new_counter));
            qutting = false;
            read_new_position_async(get_previous_pose_id(new_counter), continuation, continuation_args, suggestion_depth = suggestion_depth + 1);
        }
        else if (suggestion_depth == depth_limit) {
            //console.log("current annotation is not suggestion, we are at depth 10");
            is_current_image_annotation_suggestion = false;
            quitting = true;
//            update_image();
        }
    });


    /* read also second image annotations */
    database_name = getDatasetName_frame(new_counter + 2);
    if (!database_name.length) {
        console.log("exiting next annot")
        return;
    }

    firebase.database().ref(database_name).once('value').then(function (snapshot) {
        var val = snapshot.val();
        if (val) {
            console.log("read next annot")
            next_annotation_positions = val.position;
            console.log(next_annotation_positions);
        }

        if (quitting) {
            update_image();
            read_name();
        }
    });


    //update_image();
    // also update the user name from a previous session

}

function save_database_as_csv() {
    folder = parseURL()["folder"]
    database_name = getDatasetName_folder() + "/" + "data/" + folder;
    // console.log(database_name);
    csv_file_name = folder.replace("/", "_") + ".csv"
    if (database_name.length == 0)
        return;
    firebase.database().ref(database_name).once('value').then(function (snapshot) {
        var val = snapshot.val()
        let csvContent = "data:text/csv;charset=utf-8,";
        // save header information
        csvContent += "#image_name"
        xy_name = ["x", "y"]
        for (var l = 0; l < limb_names.length; l++) {
            for (var i = 0; i < part_names.length; i++) {
                for (var xy = 0; xy < 2; xy++) {
                    csvContent += "," + limb_names[l] + "-" + part_names[i] + "-" + xy_name[xy]
                }
            }
        }
        csvContent += "\r\n"
        // save content
        snapshot.forEach(function (child) {
            var image_key = child.key;
            csvContent += image_key + ",";
            child.forEach(function (pos) {
                var index = child.key;
                var value = child.val()["position"];
                csvContent += value;
            });
            csvContent += "\r\n";
        });
        // save to file
        var encodedUri = encodeURI(csvContent);
        var link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", csv_file_name);
        document.body.appendChild(link); // Required for FF

        link.click();
    });

}

function save_name() {
    database_name = getDatasetName_folder();
    user_name = document.getElementById('user_identification').value
    if (database_name.length == 0)
        return;
    var ref = firebase.database().ref(database_name);
    ref.update({
        user_name: user_name
    });
}

function read_name() {


    database_name = getDatasetName_folder();
    //console.log("read name");
    //console.log('read_name' + database_name)
    if (database_name.length == 0) {
        return;
    }
    firebase.database().ref(database_name + "/user_name").once('value').then(function (snapshot) {
        var val = snapshot.val();
        // console.log("Val: " + val);
        if (val) {
            document.getElementById('user_identification').value = val;
        }
    });

}


///////////////////////////////////////////
// handle new selections
function update_joint_and_frame_oneJointAllFrames() {
    var frame_counter_last = frame_counter;
    next_pose();
    if (frame_counter == frame_counter_last) {
        select_next_visible_joint();
        update_frame_counter(0);
        read_new_position_async(frame_counter);

        //console.log("pop", document.querySelector('#check_popup'));
        //if(!document.querySelector('#check_popup').checked)
        alert("You finished the annotation of the current joint.\nPlease annotate the " + select_part.options[select_part.length - 1 - select_part.value].text + " joint of '" + select_limb.options[select_limb.length - 1 - select_limb.value].text + ", starting at the first frame.");
    }
}

function update_joint_and_frame_oneFrameAllJoints() {
    var frame_counter_last = frame_counter;
    var joint_last = selected_point_id;

    if (current_camera_sees_this_joint()){
        select_next_visible_joint();
    }
    else{ // if we are annotating the supposed-to-be-not-visible joints, keep it that way
        select_next_joint();
    }

    if (joint_last > selected_point_id && config["move_selected"]) {
        var frame_last = frame_counter;
        next_pose(frame_counter);
        read_new_position_async(frame_counter);
        if (frame_counter == frame_last) {
            //console.log("pop", document.querySelector('#check_popup'));
            //if(!document.querySelector('#check_popup').checked)
            alert("You reached the end of this sequence. Have you annotated all frames? If so please proceed with the next sequence/link.\nYour token is " + getDatasetName_frame(0));
        }
    } else {
        update_image()
    }
    // inform user about frame and joint change
}

// select the proper way of cycling
var update_joint_and_frame = update_joint_and_frame_oneFrameAllJoints;

///////////////////////////////////////////
// User input listener

// text input
function userNameChanged(e) {

}

function get_previous_pose_id(f) {
    if (get_pose_id(f) == 0) {
        return f;
    }
    return Math.max(f - (config["num_cameras"] * config["step_size"]), 0);
}

function get_next_pose_id() {
    return Math.min(frame_counter + (config["num_cameras"] * config["step_size"]), getNumImages());
}

// buttons
function previous_pose(e) {
    pose_change_cache = false; // next
    update_frame_counter(get_previous_pose_id(frame_counter));
    update_html_counter(frame_counter); // assuming frame_counter is fixed first
    select_first_visible_joint();

    zero_annotations();
    read_new_position_async(frame_counter);
}

function next_pose(e) {
    //    console.log("next frame: "+e)
    pose_change_cache = true; // next
    update_frame_counter(get_next_pose_id(frame_counter));
    update_html_counter(frame_counter); // assuming frame_counter is fixed first
    select_first_visible_joint();

    zero_annotations();
    read_new_position_async(frame_counter);
}

function next_camera(e) {
    //    console.log("next frame: "+e
    if (!((frame_counter + 1) % config["num_cameras"])) {
        next_frame_counter = frame_counter - (config["num_cameras"] - 1);
    }
    else {
        next_frame_counter = frame_counter + 1;
    }

    update_frame_counter(next_frame_counter);
    update_html_counter(frame_counter); // assuming frame_counter is fixed first
    zero_annotations();
    read_new_position_async(frame_counter);

    select_first_visible_joint();
    init_pull_down(select_limb, limb_names);
    update_joint_counter(selected_point_id);
}

function previous_camera(e) {
    if (get_camera_id(frame_counter) == 0) { // then roll
        new_camera_id = config["num_cameras"] - 1;
        new_pose_id = get_pose_id(frame_counter);

        next_frame_counter = get_frame_counter_from_camera_id_and_pose_id(new_camera_id, new_pose_id);
    }
    else {
        next_frame_counter = frame_counter - 1;
    }

    update_frame_counter(next_frame_counter);
    update_html_counter(frame_counter); // assuming frame_counter is fixed first
    read_new_position_async(frame_counter);
    init_pull_down(select_limb, limb_names);
    select_first_visible_joint();
}

function update_html_counter(e) {
    if ("num_cameras" in config) {
        document.getElementById("counter").innerHTML = "<b>Camera: " + get_camera_id(frame_counter) + "<small>/" + (config["num_cameras"] - 1) + "</small>" + " \t Image ID: " + get_pose_id(frame_counter) + "<small>/" + Math.floor(config["num_images"][parseURL()["folder"]] / config["num_cameras"]) + "</small>" + "</b>";
    }
    else {
        document.getElementById("counter").innerHTML = "<b>Counter: " + e + "</b>";
    }
}

function current_image_annotation_complete() {
    for (var i = 0; i < config["camera_visible_limbs"][get_camera_id(frame_counter)].length; i++) {
        limb_id = config["camera_visible_limbs"][get_camera_id(frame_counter)][i];
        for (var j = 0; j < (is_limb_antenna(limb_id) ? 1 : part_names.length); j++) {

            if (annotation_positions[(part_names.length * limb_id + j)][0] == 0.0) {
                return false;
            }
        }
    }
    return true;
}

function current_image_annotation_suggestion() {
    return is_current_image_annotation_suggestion;
}

function get_camera_id(frame_id) {
    return frame_id % config["num_cameras"];
}

function get_frame_counter_from_camera_id_and_pose_id(camera_id, pose_id) {
    return pose_id * config["num_cameras"] + camera_id;
}

function is_limb_antenna(limb_id) {
    return (limb_id == 6 || limb_id == 7);
}

function is_point_low_confidence(pos) {
    return pos[0] < 0;
}

function get_limb_id(e) {
    return Math.floor(selected_point_id / part_names.length);
}

function get_joint_id(e) {
    return selected_point_id % part_names.length;
}

function get_pose_id(frame_counter) {
    return Math.floor(frame_counter / config["num_cameras"]);
}

function set_limb_id(limb_id) {
    selected_point_id = get_joint_id() + limb_id * 5;
}

function set_joint_id(joint_id) {
    selected_point_id = joint_id + get_limb_id() * 5;
}

function set_selected_point_id(s) {
    selected_point_id = s;
    update_joint_counter(selected_point_id);
}

function set_annotation_point(point_id, pos) {
    annotation_positions[point_id] = pos;
}

function undo(e) {
    // console.log("undo");
    s = cache_pop(undo_cache);
    if (Object.keys(s).length != 0) {
        cache_push(redo_cache, s["selected_point_id"], s["selected_point"]);
    }
    //console.log(redo_cache);
    select_next_unnotated_joint();
    update_joint_counter(selected_point_id);
}

function redo(e) {
    s = cache_pop(redo_cache);
    if (Object.keys(s).length != 0) {
        cache_push(undo_cache, s["selected_point_id"], s["selected_point"]);
    }
    select_next_unnotated_joint();
    update_joint_counter(selected_point_id);
}

function zoom_in(e) {
    image_shape[0] = 1.1 * image_shape[0];
    update_image();
}

function zoom_out(e) {
    image_shape[0] = 0.9 * image_shape[0];
    update_image();
}

function switch_move_closest(e) {
    config["move_closest"] = !config["move_closest"];

    if (!config["move_closest"]) {
        select_next_unnotated_joint();
    }

    if (config["move_closest"]) {
        document.getElementById("move_closest").style.border = "3px inset rgb(254, 0, 0)";
    }
    else {
        document.getElementById("move_closest").style.border = "3px outset rgb(254, 255, 208)";
    }
}

function switch_low_confidence(e) {
    config["low_confidence"] = !config["low_confidence"];

    if (config["low_confidence"]) {
        document.getElementById("low_confidence").style.border = "3px inset rgb(0, 255, 0)";
    }
    else {
        document.getElementById("low_confidence").style.border = "3px outset rgb(254, 255, 208)";
    }

    if (config["low_confidence"] && config["high_confidence"]) {
        switch_high_confidence();
    }
}

function switch_high_confidence(e) {
    config["high_confidence"] = !config["high_confidence"];

    if (config["high_confidence"]) {
        document.getElementById("high_confidence").style.border = "3px inset rgb(0, 0, 255)";
    }
    else {
        document.getElementById("high_confidence").style.border = "3px outset rgb(254, 255, 208)";
    }

    if (config["high_confidence"] && config["low_confidence"]) {
        switch_low_confidence();
    }
}

function switch_draw_annotation(e) {
    config["draw_annotation"] = !config["draw_annotation"];
}

function save_current_annotation() {
    is_current_image_annotation_suggestion = false;
    save_new_position_async(annotation_positions, frame_counter);

    update_image();
}

/* Mouse Listeners */
var is_mouse_down = false;
container.addEventListener("mousedown", function (event) {
    is_mouse_down = true;
    if (config["move_closest"]) { // then selected_point_id is the closest point
        var container = document.querySelector("#canvas");
        var xPosition = (event.clientX - container.getBoundingClientRect().left) / image_shape[0];
        var yPosition = (event.clientY - container.getBoundingClientRect().top) / image_shape[1];
        var pos = [xPosition, yPosition];

        //console.log("move closest");
        var best_dist = Number.MAX_VALUE; // :(
        //console.log(best_dist);
        for (var i = 0; i < num_points; i++) {
            //console.log("loop");
            if (annotation_positions[i][0] == 0) { // empty, skip
                continue;
            }
            var curr_dist = euc_dist(pos, convert_point_high_conf(annotation_positions[i]));
            // console.log(curr_dist);
            if (curr_dist < best_dist) {
                //console.log("setting new distance");
                selected_point_id = i;
                best_dist = curr_dist;
            }
        }
    }
    cache_push(undo_cache, selected_point_id, annotation_positions[selected_point_id]);
});

container.addEventListener("mouseup", function (event) {
    // get and save click position
    // console.log("mouseup");
    var container = document.querySelector("#canvas");
    var xPosition = (event.clientX - container.getBoundingClientRect().left) / image_shape[0];
    var yPosition = (event.clientY - container.getBoundingClientRect().top) / image_shape[1];
    var pos = [xPosition, yPosition];
    if (xPosition < 1.0 && yPosition < 1.0 && xPosition >= 0.0 && yPosition >= 0.0) {
        if (config["high_confidence"]) {
            pos = convert_point_high_conf(pos);
        } else if (config["low_confidence"]) {
            pos = convert_point_low_conf(pos);
        } else if (!is_point_low_confidence(annotation_positions[selected_point_id])) {
            pos = convert_point_high_conf(pos);
        } else if (is_point_low_confidence(annotation_positions[selected_point_id])) {
            pos = convert_point_low_conf(pos);
        }

        add_new_point(selected_point_id, pos);

        // move to next frame
        update_joint_and_frame();
        init_pull_down_joints(); // to check if antenna is selected
        update_joint_counter(selected_point_id); // to make sure we can the menu
    }
    is_mouse_down = false;
});

container.addEventListener("mousemove", function (event) {
    if (is_mouse_down && config["move_closest"]) {
        var container = document.querySelector("#canvas");
        var xPosition = (event.clientX - container.getBoundingClientRect().left) / image_shape[0];
        var yPosition = (event.clientY - container.getBoundingClientRect().top) / image_shape[1];
        var pos = [xPosition, yPosition];
        if (xPosition < 1.0 && yPosition < 1.0 && xPosition >= 0.0 && yPosition >= 0.0) {
            if (config["high_confidence"]) {
                annotation_positions[selected_point_id] = convert_point_high_conf(pos);
            } else if (config["low_confidence"]) {
                annotation_positions[selected_point_id] = convert_point_low_conf(pos);
            } else if (!is_point_low_confidence(annotation_positions[selected_point_id])) {
                annotation_positions[selected_point_id] = convert_point_high_conf(pos);
            } else if (is_point_low_confidence(annotation_positions[selected_point_id])) {
                annotation_positions[selected_point_id] = convert_point_low_conf(pos);
            }
            update_image();
        }
    }
});

/* Keyboard Listener */
document.onkeydown = function (e) {
    // console.log(e);
    var evtobj = window.event ? event : e;
    var key = e.keyCode ? e.keyCode : e.which;

    // if focus is on the textbox, skip
    var text_box = document.getElementById('user_identification');
    var text_box_focused = (document.activeElement === text_box);
    if (text_box_focused) {
        return;
    }


    //console.log(key);
    if (key >= 49 && key < (49 + 5)) { //0-5
        //console.log("awd");
        set_joint_id(key - 49);
        update_joint_counter(selected_point_id);
    } else if (key == 39 && evtobj.shiftKey) {
        next_camera();
    } else if (key == 38 && evtobj.shiftKey) {
        previous_camera();
    } else if (key == 68 && evtobj.shiftKey) { // shift + d
        switch_draw_annotation();
        update_image();
    } else if (key == 37 || key == 65) { // left or a
        previous_pose();
        //   e.stopPropagation(); // dont scroll the screen
    } else if (key == 39 || key == 68) { // right or d
        next_pose();
        //   e.stopPropagation(); // dont scroll the screen
    } else if (key == 38) { // up
        select_next_visible_joint();
        e.preventDefault(); // dont scroll the screen
    } else if (key == 40) { // down
        select_previous_visible_joint();
        e.preventDefault(); // dont scroll the screen
    } else if (evtobj.shiftKey && key == 189) { // shift + minus
        zoom_in(null);
    } else if (key == 189) { // minus
        zoom_out(null);
    } else if (key == 13) { // enter
        update_joint_and_frame();
    } else if (key == 90 && evtobj.ctrlKey) { // ctrl + z (undo)
        console.log("undo");
        undo();
        update_image();
    } else if (key == 90 && evtobj.ctrlKey && evtobj.shiftKey) { // ctrl + shift + z (redo)
        pop_position_from_future();
    } else if (key == 83) {
        switch_move_closest();
    } else if (key == 81 && evtobj.shiftKey) { // shift + q
        set_limb_id(3);
        update_joint_counter(selected_point_id);
    } else if (key == 87 && evtobj.shiftKey) { // shify + w
        set_limb_id(4);
        update_joint_counter(selected_point_id);
    } else if (key == 69 && evtobj.shiftKey) { // shift + e
        set_limb_id(5);
        update_joint_counter(selected_point_id);
    } else if (key == 81 && evtobj.altKey) { // alt + q
        set_limb_id(6);
        update_joint_counter(selected_point_id);
    } else if (key == 87 && evtobj.altKey) { // alt + w
        set_limb_id(7);
        update_joint_counter(selected_point_id);
    } else if (key == 81) { //q
        set_limb_id(0);
        update_joint_counter(selected_point_id);
    } else if (key == 87) { //w
        set_limb_id(1);
        update_joint_counter(selected_point_id);
    } else if (key == 69) { //e
        set_limb_id(2);
        update_joint_counter(selected_point_id);
    } else if (key == 82) { // r
        set_limb_id(6);
        update_joint_counter(selected_point_id);
    } else if (key == 84) { // t
        set_limb_id(7);
        update_joint_counter(selected_point_id);
    } else if (key == 32 && evtobj.shiftKey) { // shift + space
        select_previous_visible_joint();
        update_joint_counter(selected_point_id);
        e.preventDefault();
    } else if (key == 32) { // space
        select_next_visible_joint();
        update_joint_counter(selected_point_id);
        e.preventDefault();
    } else if (evtobj.shiftKey && key == 67) { //  shift + c
        previous_camera();
    } else if (key == 67) { // c
        next_camera();
    } else if (evtobj.shiftKey && key == 86) { // v
        switch_draw_annotation();
        update_image();
    } else if (key == 76) { // l
        switch_low_confidence();
    } else if (key == 72) { // l
        switch_high_confidence();
    }
}
