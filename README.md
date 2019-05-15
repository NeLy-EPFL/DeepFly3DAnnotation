
## Setup Guide

### Firebase setup

- Create Firebase account and a new project
- Open the Database page and create a new Realtime Database
- In the rules tab of the Database, change the rules to:

  ```
  {
    "rules": {
     "$uid": {
         ".read": "auth.uid === $uid",
         ".write": "auth.uid === $uid"
     }
    }
  }
  ```

- Under Develop > Authentication > Sign-in method, enable the Anonymous sign-in provider

### Annotation tool setup

- In the js/index.js file, add a new config dictionary.
- In the Firebase project overview, click on "Add Firebase to your web app" and copy the ```var config```. Add it to the newly created config dictionary like in the other examples.
- In the config dictionary, makes sure to include the keys ```limb_names```, ```part_names```, ```bones```, ```camera_visible_limbs```.

Example:

```
apiKey: "AIzaSyAJ7bBFfjk8RDzWcSe1yUnUfRKDTykpAQc",
authDomain: "ski-dataset.firebaseapp.com",
databaseURL: "https://ski-dataset.firebaseio.com",
projectId: "ski-dataset",
storageBucket: "ski-dataset.appspot.com",
messagingSenderId: "793102276287",

move_closest: false,
suggestions: true,
image_size: 900,
invisible_joints_color: "blue",
num_cameras: 1,
num_images: {},

limb_names: ["Person"],
camera_visible_limbs: [[0]],

part_names: ['head_top', 'neck',
             'right_shoulder', 'right_ellbow', 'right_hand', 'right_pole_basket',
             'left_shoulder', 'left_ellbow', 'left_hand', 'left_pole_basket',
             'right_hip', 'right_knee', 'right_ankle',
             'left_hip', 'left_knee', 'left_ankle',
             'right_ski_tip', 'right_toes', 'right_heel', 'right_ski_rear',
             'left_ski_tip', 'left_toes', 'left_heel', 'left_ski_rear'],

bones: [[0,1], [1,2], [2,3], [3,4], [4,5], [1,6], [6,7], [7,8], [8,9],
        [2,10], [10,11], [11,12], [6,13], [13,14], [14,15],
        [16,17], [17,18], [18,19], [12,17], [12,18],
        [20,21], [21,22], [22,23], [15,21], [15,22]]
```

### Data Set conventions

Images must be named in the following convention: ```camera_0_img_000001.png```
Place them inside the ```./data/``` folder. Images can be placed in subfolders.

## Creating Annotations

Open ```index.html``` in a web browser and change the URL to point to the specified folder like in the following example:

```
.../drosophilaannotate/index.html?folder=ski_dataset/5UHRvqx1iuQ/5+frames=s1e24+ext=.png+config=ski_dataset
```

- ```ski_dataset/5UHRvqx1iuQ/5``` is the folder inside the ```./data/``` folder where the images to annotate are located.
- ```frames=s1e24``` specifies the range of images
- ```ext=.png``` specifies the file extension of the images
- ```config=ski_dataset``` specifies the name of the config created in the setup

Provide an identification on the top of the page. Using the buttons (or keyboard shortcuts), various settings like high or low confidence in points or moving the closest point can be toggled.

By Roman Bachmann
