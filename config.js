/**
 * 前端API配置文件
 * 用于管理不同环境下的后端API地址
 */

const API_CONFIG = {
    // 开发环境（本地测试）
    development: {
        baseURL: 'http://192.168.10.116:8000',
        description: '本地开发环境'
    },
    // 生产环境（GitHub Pages + 内网穿透）
    production: {
        baseURL: 'http://45.64.112.55:9000',  // ⚠️ 替换为你的内网穿透公网地址
        // 如果使用API密钥认证，在这里配置：
        // apiKey: 'your-secret-api-key',
        description: 'GitHub Pages生产环境'
    }
};

/**
 * 自动检测当前运行环境
 * - localhost/127.0.0.1 → 开发环境
 * - GitHub Pages域名 → 生产环境
 */
const ENV = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'development'
    : 'production';

/**
 * 当前环境的API基础URL
 * 在前端代码中使用此变量替换硬编码的URL
 */
const API_BASE_URL = API_CONFIG[ENV].baseURL;

// 调试信息（可选）
console.log(`🌐 运行环境: ${ENV}`);
console.log(`🔗 API地址: ${API_BASE_URL}`);
console.log(`📝 环境说明: ${API_CONFIG[ENV].description}`);

// 可选：API请求辅助函数
const apiRequest = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 如果配置了API密钥，自动添加到请求头
    if (API_CONFIG[ENV].apiKey) {
        options.headers = {
            ...options.headers,
            'X-API-Key': API_CONFIG[ENV].apiKey
        };
    }
    
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        return response;
    } catch (error) {
        console.error(`API请求错误 (${endpoint}):`, error);
        throw error;
    }
};


