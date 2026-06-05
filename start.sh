#!/bin/bash

# 同声传译助手 - 启动脚本
# 使用方法: ./start.sh

cd "$(dirname "$0")"

# 检查是否设置了 DEEPSEEK_API_KEY 环境变量
if [ -z "$DEEPSEEK_API_KEY" ]; then
    echo "⚠️  未检测到 DEEPSEEK_API_KEY 环境变量"
    echo ""
    echo "请选择设置方式:"
    echo "1. 临时设置（本次会话有效）"
    echo "2. 永久设置（添加到 ~/.bashrc）"
    read -p "请输入选择 (1/2): " choice
    
    case $choice in
        1)
            read -p "请输入您的 DeepSeek API Key: " api_key
            export DEEPSEEK_API_KEY=$api_key
            echo "✅ 环境变量已临时设置"
            ;;
        2)
            read -p "请输入您的 DeepSeek API Key: " api_key
            echo "" >> ~/.bashrc
            echo "# DeepSeek API Key for syncinterp" >> ~/.bashrc
            echo "export DEEPSEEK_API_KEY=$api_key" >> ~/.bashrc
            echo "✅ 环境变量已永久设置到 ~/.bashrc"
            export DEEPSEEK_API_KEY=$api_key
            ;;
        *)
            echo "❌ 无效选择"
            exit 1
            ;;
    esac
else
    echo "✅ 检测到 DEEPSEEK_API_KEY 环境变量"
fi

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 安装前端依赖..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo ""
    echo "📦 安装后端依赖..."
    cd server && npm install && cd ..
fi

# 启动后端服务
echo ""
echo "🚀 启动后端服务..."
cd server && node index.js &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端开发服务器
echo ""
echo "🚀 启动前端服务..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 服务已启动"
echo "   前端: http://localhost:5173/"
echo "   后端: http://localhost:3000/"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待信号
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
