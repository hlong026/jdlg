# 后台API接入说明

## 已完成的功能

### 1. API基础设施
- ✅ API配置 (`src/config/api.ts`)
- ✅ Token管理 (`src/utils/token.ts`)
- ✅ 请求封装 (`src/utils/request.ts`)

### 2. API服务层
- ✅ 认证API (`src/api/auth.ts`)
- ✅ 用户管理API (`src/api/users.ts`)
- ✅ 商品管理API (`src/api/products.ts`)
- ✅ 礼品管理API (`src/api/gifts.ts`)
- ✅ 统计数据API (`src/api/stats.ts`)

### 3. 页面接入
- ✅ 登录页面 (`src/pages/login.tsx`)
- ✅ 工作台页面 (`src/pages/workbench.tsx`)
- ✅ 商品管理页面 (`src/pages/mall.tsx`)
- ✅ 用户管理页面 (`src/pages/users.tsx`)

## 待完成的功能

### 需要接入API的页面

1. **礼品管理页面** (`src/pages/gifts.tsx`)
   - 使用 `src/api/gifts.ts` 中的函数
   - 参考 `mall.tsx` 的实现方式

2. **仓库管理页面** (`src/pages/warehouse.tsx`)
   - 需要创建 `src/api/warehouse.ts`
   - 实现仓库相关的API调用

3. **收银系统页面** (`src/pages/cashier.tsx`)
   - 需要创建 `src/api/orders.ts` 和 `src/api/cashier.ts`
   - 实现订单创建和支付相关功能

4. **排名系统页面** (`src/pages/ranking.tsx`)
   - 使用 `src/api/ranking.ts`（需要创建）
   - 实现排名数据获取

## 环境变量配置

在项目根目录创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8080
```

## 使用示例

### 在组件中使用API

```typescript
import { useState, useEffect } from 'react';
import { getUserList } from '../api/users';

const MyComponent: React.FC = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await getUserList({ page: 1, page_size: 20 });
                setUsers(response.list);
            } catch (error) {
                console.error('加载失败:', error);
                alert('加载失败');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // ...
};
```

## 注意事项

1. **Token管理**: 所有需要认证的API请求会自动添加Token
2. **错误处理**: 401错误会自动跳转到登录页
3. **数据转换**: API返回的数据格式可能与前端使用的格式不同，需要进行转换
4. **加载状态**: 建议为所有API调用添加loading状态

## 下一步

1. 完成剩余页面的API接入
2. 添加错误提示组件
3. 添加加载状态组件
4. 优化用户体验
