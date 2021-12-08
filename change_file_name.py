import os
import glob

def change_name(full_path):
    print('Navigating to the folder')
    os.system(f'cd {full_path}')
    imgs = glob.glob(os.path.join(full_path, '*.jpg'))
    for img_name in imgs:
        img_num = int(img_name.strip('.jpg').split('_')[-1])
        new_img_name = img_name.replace(f'img_{img_num}', f'img_{img_num:06d}')
        command = f'mv {img_name} {new_img_name}'
        os.system(command)
    print(f'{full_path} is done!')
               
def get_paths_of_images(main_dir):
    directory_list = os.listdir(main_dir)
    return [os.path.join(main_dir, dir, 'behData/images') for dir in directory_list if not dir.startswith('.')]

if __name__ == '__main__':
    
    dirs_to_change_name = [
            '/Users/ozdil/Desktop/GIT/DeepFly3DAnnotation/data/210727_aJO-GAL4xUAS-CsChr_Fly001_002_Glue_behData_images',
            '/Users/ozdil/Desktop/GIT/DeepFly3DAnnotation/data/210727_aJO-GAL4xUAS-CsChr_Fly001_003_Beh_behData_images',
            '/Users/ozdil/Desktop/GIT/DeepFly3DAnnotation/data/210727_aJO-GAL4xUAS-CsChr_Fly001_004_Beh_behData_images',
            '/Users/ozdil/Desktop/GIT/DeepFly3DAnnotation/data/210727_aJO-GAL4xUAS-CsChr_Fly001_005_Beh_behData_images',
            '/Users/ozdil/Desktop/GIT/DeepFly3DAnnotation/data/210727_aJO-GAL4xUAS-CsChr_Fly001_006_Beh_behData_images'
        ]
    
    # only compress fly 001
    for folder_path in dirs_to_change_name:
        change_name(folder_path)
