import os
import requests

def download_valorant_assets():
    # 1. 定义 API 地址（指定中文）
    api_url = "https://valorant-api.com/v1/content-tiers?language=zh-CN"
    
    # 2. 创建存放目录
    save_dir = "./rarity_icons"
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
        print(f"创建目录: {save_dir}")

    try:
        # 3. 请求数据
        print("正在获取官方资源列表...")
        response = requests.get(api_url)
        response.raise_for_status()
        data = response.json()['data']

        # 4. 遍历并下载
        for tier in data:
            name = tier['displayName']
            icon_url = tier['displayIcon']
            
            if icon_url:
                print(f"正在下载: {name}...")
                img_data = requests.get(icon_url).content
                
                # 文件名建议：中文名.png
                file_path = os.path.join(save_dir, f"{name}.png")
                
                with open(file_path, 'wb') as handler:
                    handler.write(img_data)
                
        print("\n✅ 所有图标已成功下载到 ./rarity_icons 文件夹！")

    except Exception as e:
        print(f"❌ 下载出错: {e}")

if __name__ == "__main__":
    download_valorant_assets()