import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiSearch, FiPlus, FiEdit, FiTrash2, FiEye, FiCheck, FiX, FiFolder } from 'react-icons/fi';
import Layout from '../component/layout';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import {
    getTemplateList,
    getTemplateDetail,
    createTemplate,
    updateTemplate,
    updateTemplateStatus,
    updateTemplateCategory,
    deleteTemplate,
    getTemplateCategories,
    createTemplateCategory,
    deleteTemplateCategory,
    getTemplateTabConfig,
    putTemplateTabConfig,
    setTemplateFeatured,
    getFeaturedCaseGroups,
    createFeaturedCaseGroup,
    updateFeaturedCaseGroup,
    deleteFeaturedCaseGroup,
    type TemplateItem as ApiTemplate,
    type TemplateCategoryItem,
    type TabConfigItem,
    type FeaturedCaseGroup,
} from '../api/templates';
import './templates.scss';

const FiSearchIcon = FiSearch as unknown as React.ComponentType<any>;
const FiPlusIcon = FiPlus as unknown as React.ComponentType<any>;
const FiEditIcon = FiEdit as unknown as React.ComponentType<any>;
const FiTrash2Icon = FiTrash2 as unknown as React.ComponentType<any>;
const FiEyeIcon = FiEye as unknown as React.ComponentType<any>;
const FiCheckIcon = FiCheck as unknown as React.ComponentType<any>;
const FiXIcon = FiX as unknown as React.ComponentType<any>;
const FiFolderIcon = FiFolder as unknown as React.ComponentType<any>;

interface Template {
    id: string;
    name: string;
    category: string;
    // 鍙岄噸 Tab 褰掔被
    mainTab?: string;
    subTab?: string;
    thirdTab?: string;
    description: string;
    thumbnail?: string;
    previewUrl?: string;
    images?: string;
    imageWidth?: number;
    imageHeight?: number;
    price: number;
    isFree: boolean;
    isFeatured?: boolean;
    downloadCount: number;
    status: string;
    publishScope?: 'homepage_only' | 'square';
    rejectReason?: string;
    sourceType?: 'admin_upload' | 'ai_generated' | 'album_upload';
    creator: string;
    createdAt: string;
    updatedAt: string;
}

const defaultForm = {
    name: '',
    category: '',
    description: '',
    mainTab: '',
    subTab: '',
    thirdTab: '',
    // 涓婁紶鍚庣殑鍥剧墖URL鍒楄〃锛堝鍥撅級锛岀1寮犻粯璁や綔涓虹缉鐣ュ浘/涓婚瑙?
    imageUrls: [] as string[],
    price: 0,
    isFree: true,
    status: 'draft',
};

const normalizePositiveNumber = (value?: number) => {
    const num = Number(value || 0);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
};

const gcd = (left: number, right: number): number => {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b !== 0) {
        const temp = a % b;
        a = b;
        b = temp;
    }
    return a || 1;
};

const formatImageMeta = (width?: number, height?: number) => {
    const normalizedWidth = normalizePositiveNumber(width);
    const normalizedHeight = normalizePositiveNumber(height);
    if (!normalizedWidth || !normalizedHeight) {
        return '未识别';
    }
    const divisor = gcd(normalizedWidth, normalizedHeight);
    return `${normalizedWidth / divisor}:${normalizedHeight / divisor} / ${normalizedWidth}×${normalizedHeight}`;
};

type TabConfigSaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'invalid' | 'error';

const getChildTabsByParent = (items: TabConfigItem[], parentValue: string) => {
    const currentParent = (parentValue || '').trim();
    if (!currentParent) {
        return [];
    }
    return items.filter(item => (item.parent || '').trim() === currentParent);
};

const Templates: React.FC = () => {
    const initialKeyword = new URLSearchParams(window.location.search).get('keyword') || '';
    const [templates, setTemplates] = useState<Template[]>([]);
    const [categories, setCategories] = useState<TemplateCategoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchInput, setSearchInput] = useState(initialKeyword);
    const [searchKeyword, setSearchKeyword] = useState(initialKeyword);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showMoveCategoryModal, setShowMoveCategoryModal] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [moveTargetTemplate, setMoveTargetTemplate] = useState<Template | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [formData, setFormData] = useState<typeof defaultForm>(defaultForm);
    const [categoryForm, setCategoryForm] = useState({ id: '', name: '', sort_order: 0 });
    const [categorySectionOpen, setCategorySectionOpen] = useState(false);
    const [tabConfigSectionOpen, setTabConfigSectionOpen] = useState(false);
    const [mainTabs, setMainTabs] = useState<TabConfigItem[]>([]);
    const [subTabs, setSubTabs] = useState<TabConfigItem[]>([]);
    const [thirdTabs, setThirdTabs] = useState<TabConfigItem[]>([]);
    const [tabConfigSaving, setTabConfigSaving] = useState(false);
    const [tabConfigSaveState, setTabConfigSaveState] = useState<TabConfigSaveState>('idle');
    const [tabConfigSaveMessage, setTabConfigSaveMessage] = useState('');
    const tabConfigLoadedRef = useRef(false);
    const lastSavedTabConfigRef = useRef('');
    const [featuredGroupSectionOpen, setFeaturedGroupSectionOpen] = useState(false);
    const [featuredGroups, setFeaturedGroups] = useState<FeaturedCaseGroup[]>([]);
    const [loadingFeaturedGroups, setLoadingFeaturedGroups] = useState(false);
    const [showFeaturedGroupModal, setShowFeaturedGroupModal] = useState(false);
    const [selectedFeaturedGroup, setSelectedFeaturedGroup] = useState<FeaturedCaseGroup | null>(null);
    const [featuredGroupForm, setFeaturedGroupForm] = useState({
        name: '',
        display_mode: 'comparison' as 'comparison' | 'side_by_side' | 'normal',
        case1_id: '',
        case2_id: '',
        case1_label: '鐪熷疄',
        case2_label: 'AI',
        sort_order: 0,
    });

    const convertTemplate = (t: ApiTemplate): Template => ({
        id: String(t.id),
        name: t.name,
        category: t.category,
        // 鍚庣瀛楁 main_tab / sub_tab 鏄犲皠鍒板墠绔?Template 缁撴瀯
        mainTab: (t as any).main_tab || '',
        subTab: (t as any).sub_tab || '',
        thirdTab: (t as any).third_tab || '',
        description: t.description || '',
        thumbnail: t.thumbnail,
        previewUrl: t.preview_url,
        images: t.images,
        imageWidth: t.image_width,
        imageHeight: t.image_height,
        price: t.price ?? 0,
        isFree: t.is_free ?? true,
        isFeatured: t.is_featured ?? false,
        downloadCount: t.download_count || 0,
        status: t.status,
        publishScope: t.publish_scope || 'square',
        rejectReason: t.reject_reason || '',
        sourceType: t.source_type || 'admin_upload',
        creator: t.creator || '',
        createdAt: t.created_at,
        updatedAt: t.updated_at,
    });

    const loadCategories = useCallback(async () => {
        try {
            const list = await getTemplateCategories();
            setCategories(list);
        } catch (e) {
            console.error('鍔犺浇鍒嗙被澶辫触:', e);
        }
    }, []);

    const normalizeTabConfig = useCallback((mainTabsData: TabConfigItem[], subTabsData: TabConfigItem[], thirdTabsData: TabConfigItem[]) => ({
        main_tabs: mainTabsData.map(t => ({
            label: (t.label || '').trim(),
            value: (t.value || '').trim(),
        })),
        sub_tabs: subTabsData.map(t => ({
            label: (t.label || '').trim(),
            value: (t.value || '').trim(),
            parent: (t.parent || '').trim(),
        })),
        third_tabs: thirdTabsData.map(t => ({
            label: (t.label || '').trim(),
            value: (t.value || '').trim(),
            parent: (t.parent || '').trim(),
        })),
    }), []);

    const serializeTabConfig = useCallback((mainTabsData: TabConfigItem[], subTabsData: TabConfigItem[], thirdTabsData: TabConfigItem[]) => {
        return JSON.stringify(normalizeTabConfig(mainTabsData, subTabsData, thirdTabsData));
    }, [normalizeTabConfig]);

    const getTabConfigValidationError = useCallback((mainTabsData: TabConfigItem[], subTabsData: TabConfigItem[], thirdTabsData: TabConfigItem[]) => {
        if (!mainTabsData.length) {
            return '至少保留一个一级Tab';
        }

        const mainTabValues = new Set<string>();
        for (let i = 0; i < mainTabsData.length; i++) {
            const item = mainTabsData[i];
            const label = (item.label || '').trim();
            const value = (item.value || '').trim();
            if (!label) {
                return `第 ${i + 1} 个一级Tab缺少显示名`;
            }
            if (!value) {
                return `第 ${i + 1} 个一级Tab缺少 value`;
            }
            if (mainTabValues.has(value)) {
                return `一级Tab的 value 不能重复：${value}`;
            }
            mainTabValues.add(value);
        }

        const subTabValues = new Set<string>();
        for (let i = 0; i < subTabsData.length; i++) {
            const item = subTabsData[i];
            const label = (item.label || '').trim();
            const value = (item.value || '').trim();
            const parent = (item.parent || '').trim();
            if (!label) {
                return `第 ${i + 1} 个二级Tab缺少显示名`;
            }
            if (!value) {
                return `第 ${i + 1} 个二级Tab缺少 value`;
            }
            if (!parent) {
                return `第 ${i + 1} 个二级Tab必须设置所属的一级Tab`;
            }
            if (!mainTabValues.has(parent)) {
                return `第 ${i + 1} 个二级Tab的父Tab（${parent}）不存在于一级Tab列表中`;
            }
            if (subTabValues.has(value)) {
                return `二级Tab的 value 不能重复：${value}`;
            }
            subTabValues.add(value);
        }

        const thirdTabValues = new Set<string>();
        for (let i = 0; i < thirdTabsData.length; i++) {
            const item = thirdTabsData[i];
            const label = (item.label || '').trim();
            const value = (item.value || '').trim();
            const parent = (item.parent || '').trim();
            if (!label) {
                return `第 ${i + 1} 个三级Tab缺少显示名`;
            }
            if (!value) {
                return `第 ${i + 1} 个三级Tab缺少 value`;
            }
            if (!parent) {
                return `第 ${i + 1} 个三级Tab必须设置所属的二级Tab`;
            }
            if (!subTabValues.has(parent)) {
                return `第 ${i + 1} 个三级Tab的父Tab（${parent}）不存在于二级Tab列表中`;
            }
            if (thirdTabValues.has(value)) {
                return `三级Tab的 value 不能重复：${value}`;
            }
            thirdTabValues.add(value);
        }

        return '';
    }, []);

    const loadTabConfig = useCallback(async () => {
        try {
            const cfg = await getTemplateTabConfig();
            const nextMainTabs = cfg?.main_tabs?.length ? [...cfg.main_tabs] : [
                { label: '鍦烘櫙', value: 'scene' },
                { label: '椋庢牸', value: 'style' },
                { label: '鐏垫劅', value: 'inspiration' },
            ];
            // 浜岀骇tab鐜板湪鍖呭惈parent瀛楁锛屼粠鎺ュ彛鑾峰彇鏃朵細鍖呭惈
            const nextSubTabs = cfg?.sub_tabs?.length ? cfg.sub_tabs.map(t => ({ ...t, parent: t.parent || '' })) : [
                { label: '涔″澶栬', value: 'villa_exterior', parent: 'scene' },
                { label: '瀹ゅ唴绌洪棿', value: 'interior_space', parent: 'scene' },
                { label: '鑺卞洯搴櫌', value: 'garden_courtyard', parent: 'scene' },
                { label: '鏀归€犵炕鏂?, value: 'renovation', parent: 'scene' },
                { label: '鍟嗕笟绌洪棿', value: 'commercial_space', parent: 'scene' },
                { label: '璁捐杈呭姪', value: 'design_assist', parent: 'scene' },
                { label: '鏂伴椊娲?, value: 'new_minnan', parent: 'style' },
                { label: '鏂颁腑寮?, value: 'new_chinese', parent: 'style' },
                { label: '鐜颁唬椋庢牸', value: 'modern', parent: 'style' },
                { label: '缁忓吀娆у紡', value: 'classic_european', parent: 'style' },
                { label: '鍦板煙鐗硅壊', value: 'regional', parent: 'style' },
                { label: '涔″缓瓒嬪娍', value: 'rural_trend', parent: 'inspiration' },
                { label: '鐢熸椿鏂瑰紡', value: 'lifestyle', parent: 'inspiration' },
                { label: '鍦板煙鏂囧寲', value: 'regional_culture', parent: 'inspiration' },
                { label: '鍔熻兘鍒涙柊', value: 'function_innovation', parent: 'inspiration' },
                { label: '妗堜緥绮鹃€?, value: 'selected_cases', parent: 'inspiration' },
            ];
            const nextThirdTabs = cfg?.third_tabs?.length ? cfg.third_tabs.map(t => ({ ...t, parent: t.parent || '' })) : [];
            lastSavedTabConfigRef.current = serializeTabConfig(nextMainTabs, nextSubTabs, nextThirdTabs);
            tabConfigLoadedRef.current = true;
            setMainTabs(nextMainTabs);
            setSubTabs(nextSubTabs);
            setThirdTabs(nextThirdTabs);
            setTabConfigSaveState('idle');
            setTabConfigSaveMessage('');
        } catch (e) {
            console.error('鍔犺浇 Tab 閰嶇疆澶辫触:', e);
            setTabConfigSaveState('error');
            setTabConfigSaveMessage('鍔犺浇 Tab 閰嶇疆澶辫触锛岃绋嶅悗閲嶈瘯');
        }
    }, [serializeTabConfig]);

    const updateMainTabLabel = useCallback((index: number, label: string) => {
        setMainTabs(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, label } : item));
    }, []);

    const updateMainTabValue = useCallback((index: number, value: string) => {
        const previousValue = mainTabs[index]?.value || '';
        setMainTabs(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item));
        if (previousValue && previousValue !== value) {
            setSubTabs(prev => prev.map(item => item.parent === previousValue ? { ...item, parent: value } : item));
        }
    }, [mainTabs]);

    const removeMainTab = useCallback((index: number) => {
        if (mainTabs.length <= 1) {
            setTabConfigSaveState('invalid');
            setTabConfigSaveMessage('鑷冲皯淇濈暀涓€涓竴绾ab');
            return;
        }
        const removedValue = (mainTabs[index]?.value || '').trim();
        const nextMainTabs = mainTabs.filter((_, itemIndex) => itemIndex !== index);
        const nextSubTabs = removedValue ? subTabs.filter(item => item.parent !== removedValue) : subTabs;
        const nextSubTabValues = new Set(nextSubTabs.map(item => (item.value || '').trim()).filter(Boolean));
        const nextThirdTabs = thirdTabs.filter(item => nextSubTabValues.has((item.parent || '').trim()));
        setMainTabs(nextMainTabs);
        setSubTabs(nextSubTabs);
        setThirdTabs(nextThirdTabs);
        const removedSubTabCount = subTabs.length - nextSubTabs.length;
        const removedThirdTabCount = thirdTabs.length - nextThirdTabs.length;
        if (removedSubTabCount > 0 || removedThirdTabCount > 0) {
            setTabConfigSaveState('editing');
            setTabConfigSaveMessage(`已同步删除 ${removedSubTabCount} 个二级Tab 和 ${removedThirdTabCount} 个三级Tab，正在准备自动保存...`);
        }
    }, [mainTabs, subTabs, thirdTabs]);

    const updateSubTab = useCallback((index: number, patch: Partial<TabConfigItem>) => {
        const previousValue = subTabs[index]?.value || '';
        setSubTabs(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
        if (patch.value && previousValue && patch.value !== previousValue) {
            setThirdTabs(prev => prev.map(item => item.parent === previousValue ? { ...item, parent: patch.value as string } : item));
        }
    }, [subTabs]);

    const addMainTab = useCallback(() => {
        setMainTabs(prev => [...prev, { label: '', value: '' }]);
    }, []);

    const addSubTab = useCallback(() => {
        if (!mainTabs.length) {
            setTabConfigSaveState('invalid');
            setTabConfigSaveMessage('璇峰厛淇濈暀鑷冲皯涓€涓竴绾ab锛屽啀鏂板浜岀骇Tab');
            return;
        }
        const defaultParent = mainTabs.find(item => (item.value || '').trim())?.value || mainTabs[0]?.value || '';
        setSubTabs(prev => [...prev, { label: '', value: '', parent: defaultParent }]);
    }, [mainTabs]);

    const addThirdTab = useCallback(() => {
        if (!subTabs.length) {
            setTabConfigSaveState('invalid');
            setTabConfigSaveMessage('鐠囧嘲鍘涙穱婵堟殌閼峰啿鐨稉鈧稉顏冪癌缁绢湚ab閿涘苯鍟€閺傛澘顤冩稉澶岄獓Tab');
            return;
        }
        const defaultParent = subTabs.find(item => (item.value || '').trim())?.value || subTabs[0]?.value || '';
        setThirdTabs(prev => [...prev, { label: '', value: '', parent: defaultParent }]);
    }, [subTabs]);

    const handleSaveTabConfig = useCallback(async (options?: { silent?: boolean }) => {
        const validationError = getTabConfigValidationError(mainTabs, subTabs, thirdTabs);
        if (validationError) {
            setTabConfigSaveState('invalid');
            setTabConfigSaveMessage(validationError);
            if (!options?.silent) {
                alert(validationError);
            }
            return false;
        }

        setTabConfigSaving(true);
        setTabConfigSaveState('saving');
        setTabConfigSaveMessage(options?.silent ? '姝ｅ湪鑷姩淇濆瓨...' : '姝ｅ湪淇濆瓨...');
        try {
            const payload = normalizeTabConfig(mainTabs, subTabs, thirdTabs);
            await putTemplateTabConfig(payload);
            lastSavedTabConfigRef.current = serializeTabConfig(mainTabs, subTabs, thirdTabs);
            setTabConfigSaveState('saved');
            setTabConfigSaveMessage(options?.silent ? '宸茶嚜鍔ㄤ繚瀛? : '淇濆瓨鎴愬姛');
            if (!options?.silent) {
                alert('淇濆瓨鎴愬姛');
            }
            return true;
        } catch (e: any) {
            const message = e?.message || '淇濆瓨澶辫触';
            setTabConfigSaveState('error');
            setTabConfigSaveMessage(message);
            if (!options?.silent) {
                alert(message);
            }
            return false;
        } finally {
            setTabConfigSaving(false);
        }
    }, [getTabConfigValidationError, mainTabs, normalizeTabConfig, serializeTabConfig, subTabs, thirdTabs]);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page: 1, page_size: 500 };
            if (categoryFilter !== 'all') params.category = categoryFilter;
            if (statusFilter !== 'all') params.status = statusFilter;
            const res = await getTemplateList(params);
            const list = (res?.list || []).map(convertTemplate);
            setTemplates(list);
        } catch (error) {
            console.error('鍔犺浇妯℃澘鍒楄〃澶辫触:', error);
            alert('鍔犺浇妯℃澘鍒楄〃澶辫触');
        } finally {
            setLoading(false);
        }
    }, [categoryFilter, statusFilter]);

    useEffect(() => {
        // 鍔犺浇鍒嗙被鍜屽弻閲?Tab 閰嶇疆锛岀‘淇濇坊鍔?缂栬緫寮圭獥鏈夊彲閫夌殑涓€绾?浜岀骇 Tab
        loadCategories();
        loadTabConfig();
    }, [loadCategories, loadTabConfig]);

    useEffect(() => {
        if (!tabConfigLoadedRef.current) {
            return;
        }
        const currentSerialized = serializeTabConfig(mainTabs, subTabs, thirdTabs);
        if (currentSerialized === lastSavedTabConfigRef.current) {
            return;
        }
        const validationError = getTabConfigValidationError(mainTabs, subTabs, thirdTabs);
        if (validationError) {
            setTabConfigSaveState('invalid');
            setTabConfigSaveMessage(validationError);
            return;
        }
        setTabConfigSaveState('editing');
        setTabConfigSaveMessage('妫€娴嬪埌淇敼锛屾鍦ㄥ噯澶囪嚜鍔ㄤ繚瀛?..');
        const timer = window.setTimeout(() => {
            void handleSaveTabConfig({ silent: true });
        }, 800);
        return () => window.clearTimeout(timer);
    }, [getTabConfigValidationError, handleSaveTabConfig, mainTabs, serializeTabConfig, subTabs, thirdTabs]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    const filteredTemplates = templates.filter(template => {
        const matchKeyword = !searchKeyword ||
            template.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
            template.description.toLowerCase().includes(searchKeyword.toLowerCase());
        return matchKeyword;
    });

    const handleSearch = () => {
        setSearchKeyword(searchInput.trim());
    };

    const handleResetSearch = () => {
        setSearchInput('');
        setSearchKeyword('');
        setCategoryFilter('all');
        setStatusFilter('all');
    };

    const getStatusLabel = (status: string) => {
        const statusMap: Record<string, { label: string; className: string }> = {
            published: { label: '宸插彂甯?, className: 'status-published' },
            pending: { label: '寰呭鏍?, className: 'status-pending' },
            draft: { label: '鑽夌', className: 'status-draft' },
            rejected: { label: '宸叉嫆缁?, className: 'status-draft' },
            archived: { label: '宸插綊妗?, className: 'status-archived' },
        };
        return statusMap[status] || { label: status, className: '' };
    };

    const getPublishScopeLabel = (publishScope?: string) => {
        return publishScope === 'homepage_only' ? '浠呬富椤靛睍绀? : '涓婚〉 + 妯℃澘骞垮満';
    };

    const getSourceTypeLabel = (sourceType?: string) => {
        if (sourceType === 'album_upload') return '鐩稿唽涓婁紶';
        if (sourceType === 'ai_generated') return 'AI鐢熸垚鍙戝竷';
        return '鍚庡彴鍒涘缓';
    };

    const getCategoryLabel = (categoryId: string) => {
        const cat = categories.find(c => c.id === categoryId);
        return cat ? cat.name : categoryId;
    };

    const handleEdit = async (template: Template) => {
        try {
            if (!mainTabs.length || !subTabs.length) {
                await loadTabConfig();
            }
            const detail = await getTemplateDetail(template.id);
            // 杩樺師宸叉湁鍥剧墖锛?
            // 1锛変紭鍏堜粠 detail.images 瑙ｆ瀽锛堝瓧绗︿覆鏁扮粍鎴栧璞℃暟缁勶級锛?
            // 2锛夊鏋滄病鏈?images锛屼絾鏈?thumbnail/preview_url锛屽垯鐢ㄥ畠浠ˉ涓€寮狅紝閬垮厤缂栬緫鏃舵妸鑰佸浘鐗囨竻绌恒€?
            const existedImageUrls: string[] = (() => {
                const urls: string[] = [];
                if (detail.images) {
                    try {
                        const parsed = JSON.parse(detail.images);
                        if (Array.isArray(parsed)) {
                            for (const item of parsed) {
                                if (typeof item === 'string') {
                                    urls.push(item);
                                } else if (item && typeof item === 'object') {
                                    const obj = item as any;
                                    if (typeof obj.image === 'string' && obj.image) {
                                        urls.push(obj.image);
                                    } else if (typeof obj.url === 'string' && obj.url) {
                                        urls.push(obj.url);
                                    }
                                }
                            }
                        }
                    } catch {
                        // ignore parse error
                    }
                }
                if (!urls.length) {
                    if (detail.thumbnail) {
                        urls.push(detail.thumbnail);
                    } else if (detail.preview_url) {
                        urls.push(detail.preview_url);
                    }
                }
            return urls;
            })();

            setFormData({
                name: detail.name,
                category: detail.category,
                mainTab: detail.main_tab || '',
                subTab: detail.sub_tab || '',
                thirdTab: (detail as any).third_tab || '',
                description: detail.description || '',
                imageUrls: existedImageUrls,
                price: detail.price ?? 0,
                isFree: detail.is_free ?? true,
                status: detail.status,
            });
            setSelectedTemplate(template);
            setShowEditModal(true);
        } catch (e) {
            console.error(e);
            alert('鑾峰彇璇︽儏澶辫触');
        }
    };

    const buildImageFields = (urls: string[] | undefined) => {
        const list = urls && urls.length ? urls : [];
        const thumbnail = list[0] || '';
        const previewUrl = list[0] || '';
        const images = list.length ? JSON.stringify(list) : '';
        return { thumbnail, previewUrl, images };
    };

    const handleSaveEdit = async () => {
        if (!selectedTemplate) return;
        if (!formData.name.trim()) {
            alert('璇峰～鍐欏悕绉?);
            return;
        }
        setActionLoading(selectedTemplate.id);
        try {
            const { thumbnail, previewUrl, images } = buildImageFields(formData.imageUrls);
            // 鍒嗙被锛氱紪杈戞椂娌跨敤鍘熸湁鍒嗙被
            const category = formData.category || selectedTemplate.category || categories[0]?.id || 'villa';
            const updated = await updateTemplate(selectedTemplate.id, {
                name: formData.name,
                category,
                main_tab: formData.mainTab || undefined,
                sub_tab: formData.subTab || undefined,
                third_tab: formData.thirdTab || undefined,
                description: formData.description,
                thumbnail: thumbnail || undefined,
                preview_url: previewUrl || undefined,
                images: images || undefined,
                price: formData.price,
                is_free: formData.isFree,
                status: formData.status,
            });
            setTemplates(templates.map(t => t.id === selectedTemplate.id ? convertTemplate(updated) : t));
            setShowEditModal(false);
            setSelectedTemplate(null);
        } catch (e: any) {
            alert(e?.message || '鏇存柊澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddTemplate = async () => {
        if (!formData.name.trim()) {
            alert('璇峰～鍐欏悕绉?);
            return;
        }
        setActionLoading('add');
        try {
            const { thumbnail, previewUrl, images } = buildImageFields(formData.imageUrls);
            // 鍒嗙被锛氫笉鍐嶅崟鐙€夋嫨锛岄粯璁や娇鐢ㄧ涓€涓垎绫?
            const category = categories[0]?.id || 'villa';
            await createTemplate({
                name: formData.name,
                category,
                main_tab: formData.mainTab || undefined,
                sub_tab: formData.subTab || undefined,
                third_tab: formData.thirdTab || undefined,
                description: formData.description,
                thumbnail: thumbnail || undefined,
                preview_url: previewUrl || undefined,
                images: images || undefined,
                price: formData.price,
                is_free: formData.isFree,
                status: formData.status,
            });
            setShowAddModal(false);
            setFormData(defaultForm);
            loadTemplates();
        } catch (e: any) {
            alert(e?.message || '鍒涘缓澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!window.confirm('纭畾瑕佸垹闄よ繖涓ā鏉垮悧锛熸鎿嶄綔涓嶅彲鎭㈠锛?)) return;
        setActionLoading(templateId);
        try {
            await deleteTemplate(templateId);
            setTemplates(templates.filter(t => t.id !== templateId));
        } catch (error) {
            console.error('鍒犻櫎澶辫触:', error);
            alert('鍒犻櫎澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleApprove = async (template: Template) => {
        setActionLoading(template.id);
        try {
            await updateTemplateStatus(template.id, 'published');
            setTemplates(templates.map(t => t.id === template.id ? { ...t, status: 'published', rejectReason: '' } : t));
            if (selectedTemplate?.id === template.id) setSelectedTemplate({ ...selectedTemplate, status: 'published', rejectReason: '' });
        } catch (error) {
            console.error('瀹℃牳閫氳繃澶辫触:', error);
            alert('鎿嶄綔澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (template: Template) => {
        const rejectReason = window.prompt('璇疯緭鍏ユ嫆缁濆師鍥狅紙浼氬洖浼犵粰璁捐甯堬級', template.rejectReason || '');
        if (rejectReason === null) {
            return;
        }
        setActionLoading(template.id);
        try {
            await updateTemplateStatus(template.id, 'rejected', rejectReason);
            setTemplates(templates.map(t => t.id === template.id ? { ...t, status: 'rejected', rejectReason } : t));
            if (selectedTemplate?.id === template.id) setSelectedTemplate({ ...selectedTemplate, status: 'rejected', rejectReason });
        } catch (error) {
            console.error('瀹℃牳鎷掔粷澶辫触:', error);
            alert('鎿嶄綔澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMoveCategory = (template: Template) => {
        setMoveTargetTemplate(template);
        setShowMoveCategoryModal(true);
    };

    const confirmMoveCategory = async (categoryId: string) => {
        if (!moveTargetTemplate) return;
        setActionLoading(moveTargetTemplate.id);
        try {
            await updateTemplateCategory(moveTargetTemplate.id, categoryId);
            setTemplates(templates.map(t => t.id === moveTargetTemplate.id ? { ...t, category: categoryId } : t));
            setShowMoveCategoryModal(false);
            setMoveTargetTemplate(null);
        } catch (e: any) {
            alert(e?.message || '绉诲姩澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleAddCategory = async () => {
        if (!categoryForm.id.trim() || !categoryForm.name.trim()) {
            alert('璇峰～鍐欏垎绫籌D鍜屽悕绉帮紙ID 寤鸿鑻辨枃锛屽 villa銆乽rban锛?);
            return;
        }
        try {
            await createTemplateCategory({
                id: categoryForm.id.trim(),
                name: categoryForm.name.trim(),
                sort_order: categoryForm.sort_order,
            });
            setCategoryForm({ id: '', name: '', sort_order: categories.length + 1 });
            loadCategories();
        } catch (e: any) {
            alert(e?.message || '鍒涘缓鍒嗙被澶辫触');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('纭畾鍒犻櫎璇ュ垎绫伙紵鑻ヨ鍒嗙被涓嬫湁妯℃澘锛屽皢鏃犳硶鍒犻櫎銆?)) return;
        try {
            await deleteTemplateCategory(id);
            loadCategories();
        } catch (e: any) {
            alert(e?.message || '鍒犻櫎澶辫触');
        }
    };

    const handleSetFeatured = async (template: Template, isFeatured: boolean) => {
        setActionLoading(template.id);
        try {
            await setTemplateFeatured(template.id, isFeatured);
            await loadTemplates();
        } catch (e: any) {
            alert(e?.message || '鎿嶄綔澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const loadFeaturedGroups = useCallback(async () => {
        setLoadingFeaturedGroups(true);
        try {
            const res = await getFeaturedCaseGroups(1, 100);
            setFeaturedGroups(Array.isArray(res?.list) ? res.list : []);
        } catch (e: any) {
            console.error('鍔犺浇绮鹃€夋渚嬬粍澶辫触:', e);
            alert(e?.message || '鍔犺浇绮鹃€夋渚嬬粍澶辫触');
            setFeaturedGroups([]); // 鍑洪敊鏃惰缃负绌烘暟缁?
        } finally {
            setLoadingFeaturedGroups(false);
        }
    }, []);

    const handleCreateFeaturedGroup = async () => {
        if (!featuredGroupForm.name.trim() || !featuredGroupForm.case1_id) {
            alert('璇峰～鍐欑粍鍚嶇О鍜岄€夋嫨绗竴涓渚?);
            return;
        }
        if (featuredGroupForm.display_mode !== 'normal' && !featuredGroupForm.case2_id) {
            alert('瀵规瘮妯″紡鍜屽苟鎺掓ā寮忛渶瑕侀€夋嫨涓や釜妗堜緥');
            return;
        }
        setActionLoading('create-group');
        try {
            await createFeaturedCaseGroup({
                name: featuredGroupForm.name,
                display_mode: featuredGroupForm.display_mode,
                case1_id: parseInt(featuredGroupForm.case1_id, 10),
                case2_id: featuredGroupForm.case2_id ? parseInt(featuredGroupForm.case2_id, 10) : undefined,
                case1_label: featuredGroupForm.case1_label,
                case2_label: featuredGroupForm.case2_label,
                sort_order: featuredGroupForm.sort_order,
            });
            setShowFeaturedGroupModal(false);
            setFeaturedGroupForm({
                name: '',
                display_mode: 'comparison',
                case1_id: '',
                case2_id: '',
                case1_label: '鐪熷疄',
                case2_label: 'AI',
                sort_order: 0,
            });
            await loadFeaturedGroups();
        } catch (e: any) {
            alert(e?.message || '鍒涘缓澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateFeaturedGroup = async () => {
        if (!selectedFeaturedGroup) return;
        if (!featuredGroupForm.name.trim() || !featuredGroupForm.case1_id) {
            alert('璇峰～鍐欑粍鍚嶇О鍜岄€夋嫨绗竴涓渚?);
            return;
        }
        if (featuredGroupForm.display_mode !== 'normal' && !featuredGroupForm.case2_id) {
            alert('瀵规瘮妯″紡鍜屽苟鎺掓ā寮忛渶瑕侀€夋嫨涓や釜妗堜緥');
            return;
        }
        setActionLoading('update-group');
        try {
            await updateFeaturedCaseGroup(String(selectedFeaturedGroup.id), {
                name: featuredGroupForm.name,
                display_mode: featuredGroupForm.display_mode,
                case1_id: parseInt(featuredGroupForm.case1_id, 10),
                case2_id: featuredGroupForm.case2_id ? parseInt(featuredGroupForm.case2_id, 10) : undefined,
                case1_label: featuredGroupForm.case1_label,
                case2_label: featuredGroupForm.case2_label,
                sort_order: featuredGroupForm.sort_order,
            });
            setShowFeaturedGroupModal(false);
            setSelectedFeaturedGroup(null);
            await loadFeaturedGroups();
        } catch (e: any) {
            alert(e?.message || '鏇存柊澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteFeaturedGroup = async (groupId: number) => {
        if (!window.confirm('纭畾瑕佸垹闄よ繖涓簿閫夋渚嬬粍鍚楋紵')) return;
        setActionLoading(`group-${groupId}`);
        try {
            await deleteFeaturedCaseGroup(String(groupId));
            await loadFeaturedGroups();
        } catch (e: any) {
            alert(e?.message || '鍒犻櫎澶辫触');
        } finally {
            setActionLoading(null);
        }
    };

    const openEditFeaturedGroup = (group: FeaturedCaseGroup) => {
        if (!group) return;
        setSelectedFeaturedGroup(group);
        setFeaturedGroupForm({
            name: group.name || '',
            display_mode: group.display_mode || 'comparison',
            case1_id: String(group.case1_id || ''),
            case2_id: String(group.case2_id || ''),
            case1_label: group.case1_label || '鐪熷疄',
            case2_label: group.case2_label || 'AI',
            sort_order: group.sort_order || 0,
        });
        setShowFeaturedGroupModal(true);
    };

    return (
        <Layout title="妯℃澘骞垮満绠＄悊">
            <div className="templates-container">
                <div className="templates-toolbar section-card">
                    <div className="templates-toolbar-top">
                        <div className="toolbar-title-block">
                            <h3>妯℃澘妫€绱笌鍐呭杩愯惀</h3>
                            <p>鍏堟寜鍏抽敭璇嶃€佸垎绫诲拰鐘舵€佺缉灏忚寖鍥达紝鍐嶅喅瀹氭槸鍋氭ā鏉垮鏍搞€佸垎绫绘暣鐞嗭紝杩樻槸璋冩暣棣栭〉绮鹃€夋渚嬩笌鍙岄噸 Tab 缁撴瀯銆?/p>
                        </div>
                        <div className="toolbar-actions management-actions">
                            <button className="btn-secondary" onClick={() => { setFeaturedGroupSectionOpen(!featuredGroupSectionOpen); if (!featuredGroupSectionOpen) loadFeaturedGroups(); }}>
                                馃搵 绮鹃€夋渚嬬粍绠＄悊
                            </button>
                            <button className="btn-secondary" onClick={() => { setTabConfigSectionOpen(!tabConfigSectionOpen); if (!tabConfigSectionOpen) loadTabConfig(); }}>
                                鍙岄噸 Tab 璁剧疆
                            </button>
                            <button className="btn-secondary" onClick={() => setCategorySectionOpen(!categorySectionOpen)}>
                                <FiFolderIcon /> 鍒嗙被绠＄悊
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    if (!mainTabs.length || !subTabs.length) {
                                        loadTabConfig();
                                    }
                                    setFormData(defaultForm);
                                    setShowAddModal(true);
                                }}
                            >
                                <FiPlusIcon /> 娣诲姞妯℃澘
                            </button>
                        </div>
                    </div>
                    <div className="toolbar-left">
                        <div className="search-box">
                            <FiSearchIcon className="search-icon" />
                            <input
                                type="text"
                                placeholder="鎼滅储妯℃澘鍚嶇О鎴栨弿杩?.."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch();
                                    }
                                }}
                                className="search-input"
                            />
                        </div>
                        <div className="filters">
                            <select
                                className="filter-select"
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                            >
                                <option value="all">鍏ㄩ儴鍒嗙被</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <select
                                className="filter-select"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">鍏ㄩ儴鐘舵€?/option>
                                <option value="pending">寰呭鏍?/option>
                                <option value="published">宸插彂甯?/option>
                                <option value="draft">鑽夌</option>
                                <option value="rejected">宸叉嫆缁?/option>
                                <option value="archived">宸插綊妗?/option>
                            </select>
                        </div>
                    </div>
                    <div className="templates-toolbar-footer">
                        <div className="toolbar-summary">
                            褰撳墠鏄剧ず <strong>{filteredTemplates.length}</strong> / {templates.length} 涓ā鏉?
                            {searchKeyword ? <span className="summary-tag">鍏抽敭璇嶏細{searchKeyword}</span> : null}
                            {categoryFilter !== 'all' ? <span className="summary-tag">鍒嗙被锛歿getCategoryLabel(categoryFilter)}</span> : null}
                            {statusFilter !== 'all' ? <span className="summary-tag">鐘舵€侊細{getStatusLabel(statusFilter).label}</span> : null}
                        </div>
                        <div className="toolbar-actions search-actions">
                            <button className="btn-secondary" onClick={handleResetSearch}>閲嶇疆绛涢€?/button>
                            <button className="btn-primary" onClick={handleSearch}>鎼滅储妯℃澘</button>
                        </div>
                    </div>
                </div>

                {tabConfigSectionOpen && (
                    <div className="section-card tab-config-management">
                        <h4>妯℃澘骞垮満鍙岄噸 Tab锛堝皬绋嬪簭绔粠鎺ュ彛鑾峰彇锛?/h4>
                        <div className="tab-config-grid">
                            <div className="tab-config-block">
                                <h5>涓€绾?Tab锛坢ain_tabs锛?/h5>
                                {mainTabs.map((t, i) => (
                                    <div key={i} className="tab-config-row">
                                        <input
                                            className="form-input small"
                                            placeholder="灞曠ず鍚?
                                            value={t.label}
                                            onChange={(e) => updateMainTabLabel(i, e.target.value)}
                                        />
                                        <input
                                            className="form-input small"
                                            placeholder="value"
                                            value={t.value}
                                            onChange={(e) => updateMainTabValue(i, e.target.value)}
                                        />
                                        <button type="button" className="btn-action btn-delete" onClick={() => removeMainTab(i)} title="鍒犻櫎">
                                            <FiTrash2Icon size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary btn-sm" onClick={addMainTab}>
                                    鏂板涓€绾?Tab
                                </button>
                            </div>
                            <div className="tab-config-block">
                                <h5>浜岀骇 Tab锛坰ub_tabs锛屽繀椤婚毝灞炰簬鐖禩ab锛?/h5>
                                {subTabs.map((t, i) => (
                                    <div key={i} className="tab-config-row">
                                        <input
                                            className="form-input small"
                                            placeholder="灞曠ず鍚?
                                            value={t.label}
                                            onChange={(e) => updateSubTab(i, { label: e.target.value })}
                                        />
                                        <input
                                            className="form-input small"
                                            placeholder="value"
                                            value={t.value}
                                            onChange={(e) => updateSubTab(i, { value: e.target.value })}
                                        />
                                        <select
                                            className="form-input small"
                                            placeholder="鐖禩ab"
                                            value={t.parent || ''}
                                            onChange={(e) => updateSubTab(i, { parent: e.target.value })}
                                        >
                                            <option value="">璇烽€夋嫨鐖禩ab</option>
                                            {mainTabs.map((mt, mtIndex) => <option key={`${mt.value || 'empty'}-${mtIndex}`} value={mt.value}>{mt.label || '鏈懡鍚嶄竴绾ab'}</option>)}
                                        </select>
                                        <button type="button" className="btn-action btn-delete" onClick={() => {
                                            const removedValue = (subTabs[i]?.value || '').trim();
                                            setSubTabs(subTabs.filter((_, j) => j !== i));
                                            if (removedValue) {
                                                setThirdTabs(thirdTabs.filter(item => (item.parent || '').trim() !== removedValue));
                                            }
                                        }} title="鍒犻櫎">
                                            <FiTrash2Icon size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary btn-sm" onClick={addSubTab}>
                                    鏂板浜岀骇 Tab
                                </button>
                            </div>
                            <div className="tab-config-block">
                                <h5>娑撳楠?Tab閿涘澅hird_tabs閿涘苯绻€妞ゅ姣濈仦鐐扮艾娴滃瞼楠嘥ab閿?/h5>
                                {thirdTabs.map((t, i) => (
                                    <div key={i} className="tab-config-row">
                                        <input
                                            className="form-input small"
                                            placeholder="鐏炴洜銇氶崥?
                                            value={t.label}
                                            onChange={(e) => setThirdTabs(thirdTabs.map((item, itemIndex) => itemIndex === i ? { ...item, label: e.target.value } : item))}
                                        />
                                        <input
                                            className="form-input small"
                                            placeholder="value"
                                            value={t.value}
                                            onChange={(e) => setThirdTabs(thirdTabs.map((item, itemIndex) => itemIndex === i ? { ...item, value: e.target.value } : item))}
                                        />
                                        <select
                                            className="form-input small"
                                            placeholder="閻栫Ιab"
                                            value={t.parent || ''}
                                            onChange={(e) => setThirdTabs(thirdTabs.map((item, itemIndex) => itemIndex === i ? { ...item, parent: e.target.value } : item))}
                                        >
                                            <option value="">鐠囩兘鈧瀚ㄩ悥绂゛b</option>
                                            {subTabs.map((st, stIndex) => <option key={`${st.value || 'empty'}-${stIndex}`} value={st.value}>{st.label || '閺堫亜鎳￠崥宥勭癌缁绢湚ab'}</option>)}
                                        </select>
                                        <button type="button" className="btn-action btn-delete" onClick={() => setThirdTabs(thirdTabs.filter((_, j) => j !== i))} title="閸掔娀娅?>
                                            <FiTrash2Icon size={14} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" className="btn-secondary btn-sm" onClick={addThirdTab}>
                                    閺傛澘顤冩稉澶岄獓 Tab
                                </button>
                            </div>
                        </div>
                        <div className="tab-config-footer">
                            <span style={{ fontSize: 12, color: tabConfigSaveState === 'error' || tabConfigSaveState === 'invalid' ? '#d14343' : tabConfigSaveState === 'saved' ? '#2f7a4d' : '#666' }}>
                                {tabConfigSaveMessage || '淇敼鍚庡皢鑷姩淇濆瓨'}
                            </span>
                            <button className="btn-primary" onClick={() => { void handleSaveTabConfig(); }} disabled={tabConfigSaving}>
                                {tabConfigSaving ? '淇濆瓨涓?..' : '淇濆瓨 Tab 閰嶇疆'}
                            </button>
                        </div>
                    </div>
                )}

                {featuredGroupSectionOpen && (
                    <div className="section-card featured-group-management">
                        <div className="section-header">
                            <h4>棣栭〉绮鹃€夋渚嬬粍绠＄悊</h4>
                            <button className="btn-primary btn-sm" onClick={() => { setSelectedFeaturedGroup(null); setFeaturedGroupForm({ name: '', display_mode: 'comparison', case1_id: '', case2_id: '', case1_label: '鐪熷疄', case2_label: 'AI', sort_order: 0 }); setShowFeaturedGroupModal(true); }}>
                                <FiPlusIcon /> 鏂板缓妗堜緥缁?
                            </button>
                        </div>
                        <p className="section-desc">妗堜緥缁勫皢鏄剧ず鍦ㄥ皬绋嬪簭棣栭〉鐨?绮鹃€夋渚嬪姣?鍖哄煙锛屾瘡缁勫寘鍚?-2涓渚嬶紝鏀寔瀵规瘮妯″紡銆佸苟鎺掓ā寮忓拰鏅€氭ā寮?/p>
                        {loadingFeaturedGroups ? (
                            <div className="loading-state">鍔犺浇涓?..</div>
                        ) : (
                            <div className="featured-group-list">
                                {!featuredGroups || featuredGroups.length === 0 ? (
                                    <div className="empty-state">鏆傛棤绮鹃€夋渚嬬粍</div>
                                ) : (
                                    featuredGroups.map((group) => {
                                        if (!group) return null;
                                        return (
                                            <div key={group.id} className="featured-group-item">
                                                <div className="featured-group-content">
                                                    <div className="featured-group-header">
                                                        <h5>{group.name || '鏈懡鍚?}</h5>
                                                        <span className="group-mode-badge">{group.display_mode === 'comparison' ? '瀵规瘮妯″紡' : group.display_mode === 'side_by_side' ? '骞舵帓妯″紡' : '鏅€氭ā寮?}</span>
                                                    </div>
                                                    <div className="featured-group-cases">
                                                        <div className="case-item">
                                                            <div className="case-label">{group.case1_label || '妗堜緥1'}</div>
                                                            {group.case1 ? (
                                                                <div className="case-info">
                                                                    <img src={group.case1.thumbnail || group.case1.preview_url || '/placeholder.png'} alt={group.case1.name || '妗堜緥'} className="case-thumbnail" />
                                                                    <span>{group.case1.name || '鏈懡鍚嶆渚?}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="case-missing">妗堜緥涓嶅瓨鍦?/span>
                                                            )}
                                                        </div>
                                                        {group.case2_id > 0 && (
                                                            <>
                                                                <div className="case-divider">VS</div>
                                                                <div className="case-item">
                                                                    <div className="case-label">{group.case2_label || '妗堜緥2'}</div>
                                                                    {group.case2 ? (
                                                                        <div className="case-info">
                                                                            <img src={group.case2.thumbnail || group.case2.preview_url || '/placeholder.png'} alt={group.case2.name || '妗堜緥'} className="case-thumbnail" />
                                                                            <span>{group.case2.name || '鏈懡鍚嶆渚?}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="case-missing">妗堜緥涓嶅瓨鍦?/span>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="featured-group-meta">
                                                        <span>鎺掑簭: {group.sort_order ?? 0}</span>
                                                    </div>
                                                </div>
                                                <div className="featured-group-actions">
                                                    <button className="btn-action btn-edit" onClick={() => openEditFeaturedGroup(group)} title="缂栬緫">
                                                        <FiEditIcon size={14} />
                                                    </button>
                                                    <button
                                                        className="btn-action btn-delete"
                                                        onClick={() => handleDeleteFeaturedGroup(group.id)}
                                                        disabled={actionLoading === `group-${group.id}`}
                                                        title="鍒犻櫎"
                                                    >
                                                        <FiTrash2Icon size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                )}

                {categorySectionOpen && (
                    <div className="category-management section-card">
                        <h4>鍒嗙被鍒楄〃</h4>
                        <div className="category-list">
                            {categories.map((c) => (
                                <div key={c.id} className="category-row">
                                    <span><strong>{c.id}</strong> - {c.name}</span>
                                    <button className="btn-action btn-delete" onClick={() => handleDeleteCategory(c.id)} title="鍒犻櫎鍒嗙被">
                                        <FiTrash2Icon size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="category-add">
                            <input
                                placeholder="鍒嗙被ID锛堣嫳鏂囷級"
                                value={categoryForm.id}
                                onChange={(e) => setCategoryForm(f => ({ ...f, id: e.target.value }))}
                                className="form-input small"
                            />
                            <input
                                placeholder="鍒嗙被鍚嶇О"
                                value={categoryForm.name}
                                onChange={(e) => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                                className="form-input small"
                            />
                            <input
                                type="number"
                                placeholder="鎺掑簭"
                                value={categoryForm.sort_order || ''}
                                onChange={(e) => setCategoryForm(f => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                                className="form-input small"
                                style={{ width: 80 }}
                            />
                            <button className="btn-primary" onClick={handleAddCategory}>鏂板鍒嗙被</button>
                        </div>
                    </div>
                )}

                <div className="templates-stats">
                    <div className="stat-item">
                        <span className="stat-label">妯℃澘鎬绘暟</span>
                        <span className="stat-value">{templates.length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">寰呭鏍?/span>
                        <span className="stat-value">{templates.filter(t => t.status === 'pending').length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">宸插彂甯?/span>
                        <span className="stat-value">{templates.filter(t => t.status === 'published').length}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">鎬讳笅杞介噺</span>
                        <span className="stat-value">{templates.reduce((sum, t) => sum + t.downloadCount, 0)}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">鍔犺浇涓?..</div>
                ) : (
                    <div className="templates-grid">
                        {filteredTemplates.length === 0 ? (
                            <div className="empty-state">鏆傛棤妯℃澘鏁版嵁</div>
                        ) : (
                            filteredTemplates.map((template) => (
                                <div key={template.id} className="template-card">
                                    <div className="template-thumbnail">
                                        {template.thumbnail ? (
                                            <img src={template.thumbnail} alt={template.name} />
                                        ) : (
                                            <div className="thumbnail-placeholder"><FiEyeIcon size={32} /></div>
                                        )}
                                    </div>
                                    <div className="template-content">
                                        <div className="template-header">
                                            <h3 className="template-name">{template.name}</h3>
                                            <span className={`status-badge ${getStatusLabel(template.status).className}`}>
                                                {getStatusLabel(template.status).label}
                                            </span>
                                        </div>
                                        <p className="template-description">
                                            {template.description.slice(0, 80)}{template.description.length > 80 ? '...' : ''}
                                        </p>
                                        <div className="template-meta">
                                            <span className="meta-item">
                                                <span className="meta-label">鍒嗙被:</span>
                                                {getCategoryLabel(template.category)}
                                            </span>
                                            <span className="meta-item">
                                                <span className="meta-label">鍘诲悜:</span>
                                                {getPublishScopeLabel(template.publishScope)}
                                            </span>
                                            <span className="meta-item">
                                                <span className="meta-label">鏉ユ簮:</span>
                                                {getSourceTypeLabel(template.sourceType)}
                                            </span>
                                            <span className="meta-item">
                                                <span className="meta-label">涓嬭浇:</span>
                                                {template.downloadCount}
                                            </span>
                                            <span className="meta-item meta-item-image">
                                                <span className="meta-label">灏哄:</span>
                                                {formatImageMeta(template.imageWidth, template.imageHeight)}
                                            </span>
                                        </div>
                                        {template.rejectReason ? (
                                            <p className="template-description">鎷掔粷鍘熷洜锛歿template.rejectReason}</p>
                                        ) : null}
                                        <div className="template-footer">
                                            <span className="template-creator">鍒涘缓鑰? {template.creator}</span>
                                            <div className="template-actions">
                                                {template.status === 'pending' && (
                                                    <>
                                                        <button className="btn-action btn-approve" onClick={() => handleApprove(template)} disabled={actionLoading === template.id} title="閫氳繃">
                                                            <FiCheckIcon size={14} /> 閫氳繃
                                                        </button>
                                                        <button className="btn-action btn-reject" onClick={() => handleReject(template)} disabled={actionLoading === template.id} title="鎷掔粷">
                                                            <FiXIcon size={14} /> 鎷掔粷
                                                        </button>
                                                    </>
                                                )}
                                                {template.status === 'published' && (
                                                    <button
                                                        className={`btn-action ${template.isFeatured ? 'btn-featured-active' : 'btn-featured'}`}
                                                        onClick={() => handleSetFeatured(template, !template.isFeatured)}
                                                        disabled={actionLoading === template.id}
                                                        title={template.isFeatured ? '鍙栨秷绮鹃€? : '璁句负绮鹃€?}
                                                    >
                                                        {template.isFeatured ? '猸?宸茬簿閫? : '猸?璁句负绮鹃€?}
                                                    </button>
                                                )}
                                                <button className="btn-action btn-move" onClick={() => handleMoveCategory(template)} title="绉诲姩鍒嗙被">
                                                    <FiFolderIcon size={14} />
                                                </button>
                                                <button className="btn-action btn-edit" onClick={() => handleEdit(template)} title="缂栬緫">
                                                    <FiEditIcon size={14} />
                                                </button>
                                                <button className="btn-action btn-delete" onClick={() => handleDelete(template.id)} disabled={actionLoading === template.id} title="鍒犻櫎">
                                                    <FiTrash2Icon size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 娣诲姞妯℃澘寮圭獥 */}
                {showAddModal && (
                    <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                        <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>娣诲姞妯℃澘</h3>
                                <button className="modal-close" onClick={() => setShowAddModal(false)}>鉁?/button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>鍚嶇О *</label>
                                    <input className="form-input" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="妯℃澘鍚嶇О" />
                                </div>
                                {/* 鍒嗙被鐢辩郴缁熸牴鎹厤缃嚜鍔ㄥ鐞嗭紝杩欓噷涓嶅啀鍗曠嫭閫夋嫨 */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>涓€绾ab锛堝彲閫夛級</label>
                                        <select className="form-input" value={formData.mainTab} onChange={(e) => {
                                            const mainTabValue = e.target.value;
                                            setFormData(f => ({ ...f, mainTab: mainTabValue, subTab: '', thirdTab: '' })); // 鍒囨崲鐖秚ab鏃舵竻绌哄瓙tab
                                        }}>
                                            <option value="">涓嶈缃紙浠呭垎绫伙級</option>
                                            {mainTabs.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>浜岀骇Tab锛堝彲閫夛級</label>
                                        <select className="form-input" value={formData.subTab} onChange={(e) => setFormData(f => ({ ...f, subTab: e.target.value, thirdTab: '' }))} disabled={!formData.mainTab}>
                                            <option value="">涓嶈缃紙浠呯埗Tab锛?/option>
                                            {formData.mainTab && getChildTabsByParent(subTabs, formData.mainTab).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>三级Tab（可选）</label>
                                    <select className="form-input" value={formData.thirdTab} onChange={(e) => setFormData(f => ({ ...f, thirdTab: e.target.value }))} disabled={!formData.subTab || getChildTabsByParent(thirdTabs, formData.subTab).length === 0}>
                                        <option value="">不设置（仅二级Tab）</option>
                                        {formData.subTab && getChildTabsByParent(thirdTabs, formData.subTab).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>鎻忚堪</label>
                                    <textarea className="form-input" rows={3} value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="妯℃澘鎻忚堪" />
                                </div>
                                <div className="form-group">
                                    <label>妯℃澘鍥剧墖锛堟敮鎸佸鍥撅級</label>
                                    <div className="image-upload-group">
                                        <input
                                            id="template-images-upload"
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={async (e) => {
                                                const files = Array.from(e.target.files || []);
                                                if (!files.length) return;
                                                const uploaded: string[] = [];
                                                for (const file of files) {
                                                    const formDataUpload = new FormData();
                                                    formDataUpload.append('file', file);
                                                    try {
                                                        const resp = await fetch(`${API_BASE_URL}${API_ENDPOINTS.OSS.UPLOAD}`, {
                                                            method: 'POST',
                                                            credentials: 'include',
                                                            body: formDataUpload,
                                                        });
                                                        const result = await resp.json();
                                                        if (resp.ok && result.code === 0 && result.data?.url) {
                                                            uploaded.push(result.data.url);
                                                        } else {
                                                            alert(result.msg || '涓婁紶澶辫触');
                                                        }
                                                    } catch (err: any) {
                                                        alert('涓婁紶澶辫触: ' + (err?.message || '鏈煡閿欒'));
                                                    }
                                                }
                                                if (uploaded.length) {
                                                    setFormData(f => ({
                                                        ...f,
                                                        imageUrls: [...(f.imageUrls || []), ...uploaded],
                                                    }));
                                                }
                                                // 娓呯┖ input锛岄伩鍏嶅悓涓€鏂囦欢涓嶈Е鍙?change
                                                e.target.value = '';
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                                const input = document.getElementById('template-images-upload') as HTMLInputElement | null;
                                                input?.click();
                                            }}
                                        >
                                            閫夋嫨鍥剧墖骞朵笂浼?
                                        </button>
                                    </div>
                                    {selectedTemplate && (
                                        <div className="image-size-tip">
                                            当前封面尺寸：{formatImageMeta(selectedTemplate.imageWidth, selectedTemplate.imageHeight)}
                                        </div>
                                    )}
                                    {formData.imageUrls && formData.imageUrls.length > 0 && (
                                        <div className="image-preview-list">
                                            {formData.imageUrls.map((url, idx) => (
                                                <div key={url + idx} className="image-preview-item">
                                                    <img
                                                        src={url}
                                                        alt={`鍥?{idx + 1}`}
                                                        className="image-preview-thumb"
                                                        onClick={() => window.open(url, '_blank')}
                                                    />
                                                    <div className="image-preview-meta">
                                                        {idx === 0 && <span className="badge-primary">棣栧浘锛堢缉鐣ュ浘/涓诲浘锛?/span>}
                                                        <button
                                                            type="button"
                                                            className="btn-action btn-delete"
                                                            onClick={() =>
                                                                setFormData(f => ({
                                                                    ...f,
                                                                    imageUrls: (f.imageUrls || []).filter((_, i) => i !== idx),
                                                                }))
                                                            }
                                                        >
                                                            鍒犻櫎
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>浠锋牸锛堢伒鐭筹級</label>
                                        <input type="number" className="form-input" value={formData.price || ''} onChange={(e) => setFormData(f => ({ ...f, price: parseInt(e.target.value, 10) || 0 }))} />
                                    </div>
                                    <div className="form-group form-group-inline">
                                        <label>
                                            <input type="checkbox" checked={formData.isFree} onChange={(e) => setFormData(f => ({ ...f, isFree: e.target.checked }))} />
                                            鍏嶈垂
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label>鐘舵€?/label>
                                        <select className="form-input" value={formData.status} onChange={(e) => setFormData(f => ({ ...f, status: e.target.value }))}>
                                            <option value="draft">鑽夌</option>
                                            <option value="published">宸插彂甯?/option>
                                            <option value="archived">宸插綊妗?/option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setShowAddModal(false)}>鍙栨秷</button>
                                <button className="btn-primary" onClick={handleAddTemplate} disabled={actionLoading === 'add'}>淇濆瓨</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 缂栬緫妯℃澘寮圭獥 */}
                {showEditModal && selectedTemplate && (
                    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                        <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>缂栬緫妯℃澘</h3>
                                <button className="modal-close" onClick={() => setShowEditModal(false)}>鉁?/button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>鍚嶇О *</label>
                                    <input className="form-input" value={formData.name} onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="妯℃澘鍚嶇О" />
                                </div>
                                {/* 鍒嗙被鐢辩郴缁熸牴鎹厤缃嚜鍔ㄥ鐞嗭紝杩欓噷涓嶅啀鍗曠嫭閫夋嫨 */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>涓€绾ab锛堝彲閫夛級</label>
                                        <select className="form-input" value={formData.mainTab} onChange={(e) => {
                                            const mainTabValue = e.target.value;
                                            setFormData(f => ({ ...f, mainTab: mainTabValue, subTab: '', thirdTab: '' })); // 鍒囨崲鐖秚ab鏃舵竻绌哄瓙tab
                                        }}>
                                            <option value="">涓嶈缃紙浠呭垎绫伙級</option>
                                            {mainTabs.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>浜岀骇Tab锛堝彲閫夛級</label>
                                        <select className="form-input" value={formData.subTab} onChange={(e) => setFormData(f => ({ ...f, subTab: e.target.value, thirdTab: '' }))} disabled={!formData.mainTab}>
                                            <option value="">涓嶈缃紙浠呯埗Tab锛?/option>
                                            {formData.mainTab && getChildTabsByParent(subTabs, formData.mainTab).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>三级Tab（可选）</label>
                                    <select className="form-input" value={formData.thirdTab} onChange={(e) => setFormData(f => ({ ...f, thirdTab: e.target.value }))} disabled={!formData.subTab || getChildTabsByParent(thirdTabs, formData.subTab).length === 0}>
                                        <option value="">不设置（仅二级Tab）</option>
                                        {formData.subTab && getChildTabsByParent(thirdTabs, formData.subTab).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>鎻忚堪</label>
                                    <textarea className="form-input" rows={3} value={formData.description} onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="妯℃澘鎻忚堪" />
                                </div>
                                <div className="form-group">
                                    <label>妯℃澘鍥剧墖锛堟敮鎸佸鍥撅級</label>
                                    <div className="image-upload-group">
                                        {/* 澶嶇敤鍚屼竴涓?input锛岀紪杈戝脊绐椾粎瑙﹀彂 click */}
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                                const input = document.getElementById('template-images-upload') as HTMLInputElement | null;
                                                input?.click();
                                            }}
                                        >
                                            閫夋嫨鍥剧墖骞朵笂浼?
                                        </button>
                                    </div>
                                    {formData.imageUrls && formData.imageUrls.length > 0 && (
                                        <div className="image-preview-list">
                                            {formData.imageUrls.map((url, idx) => (
                                                <div key={url + idx} className="image-preview-item">
                                                    <img
                                                        src={url}
                                                        alt={`鍥?{idx + 1}`}
                                                        className="image-preview-thumb"
                                                        onClick={() => window.open(url, '_blank')}
                                                    />
                                                    <div className="image-preview-meta">
                                                        {idx === 0 && <span className="badge-primary">棣栧浘锛堢缉鐣ュ浘/涓诲浘锛?/span>}
                                                        <button
                                                            type="button"
                                                            className="btn-action btn-delete"
                                                            onClick={() =>
                                                                setFormData(f => ({
                                                                    ...f,
                                                                    imageUrls: (f.imageUrls || []).filter((_, i) => i !== idx),
                                                                }))
                                                            }
                                                        >
                                                            鍒犻櫎
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>浠锋牸锛堢伒鐭筹級</label>
                                        <input type="number" className="form-input" value={formData.price || ''} onChange={(e) => setFormData(f => ({ ...f, price: parseInt(e.target.value, 10) || 0 }))} />
                                    </div>
                                    <div className="form-group form-group-inline">
                                        <label>
                                            <input type="checkbox" checked={formData.isFree} onChange={(e) => setFormData(f => ({ ...f, isFree: e.target.checked }))} />
                                            鍏嶈垂
                                        </label>
                                    </div>
                                    <div className="form-group">
                                        <label>鐘舵€?/label>
                                        <select className="form-input" value={formData.status} onChange={(e) => setFormData(f => ({ ...f, status: e.target.value }))}>
                                            <option value="draft">鑽夌</option>
                                            <option value="pending">寰呭鏍?/option>
                                            <option value="published">宸插彂甯?/option>
                                            <option value="archived">宸插綊妗?/option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>鍙栨秷</button>
                                <button className="btn-primary" onClick={handleSaveEdit} disabled={actionLoading === selectedTemplate.id}>淇濆瓨</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 绉诲姩鍒嗙被寮圭獥 */}
                {showMoveCategoryModal && moveTargetTemplate && (
                    <div className="modal-overlay" onClick={() => setShowMoveCategoryModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>绉诲姩銆寋moveTargetTemplate.name}銆嶅埌鍒嗙被</h3>
                                <button className="modal-close" onClick={() => setShowMoveCategoryModal(false)}>鉁?/button>
                            </div>
                            <div className="modal-body">
                                <p className="modal-hint">鐐瑰嚮鐩爣鍒嗙被瀹屾垚绉诲姩锛?/p>
                                <div className="move-category-btns">
                                    {categories.filter(c => c.id !== moveTargetTemplate.category).map(c => (
                                        <button
                                            key={c.id}
                                            className="btn-secondary"
                                            onClick={() => confirmMoveCategory(c.id)}
                                            disabled={actionLoading === moveTargetTemplate.id}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                    {categories.filter(c => c.id !== moveTargetTemplate.category).length === 0 && (
                                        <span className="text-muted">鏆傛棤鍏朵粬鍒嗙被</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 绮鹃€夋渚嬬粍缂栬緫寮圭獥 */}
                {showFeaturedGroupModal && (
                    <div className="modal-overlay" onClick={() => setShowFeaturedGroupModal(false)}>
                        <div className="modal-content modal-form" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>{selectedFeaturedGroup ? '缂栬緫绮鹃€夋渚嬬粍' : '鏂板缓绮鹃€夋渚嬬粍'}</h3>
                                <button className="modal-close" onClick={() => setShowFeaturedGroupModal(false)}>鉁?/button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>缁勫悕绉?*</label>
                                    <input
                                        className="form-input"
                                        value={featuredGroupForm.name}
                                        onChange={(e) => setFeaturedGroupForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="渚嬪锛氱湡瀹炲満鏅?vs AI璁捐"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>鏄剧ず妯″紡 *</label>
                                    <select
                                        className="form-input"
                                        value={featuredGroupForm.display_mode}
                                        onChange={(e) => setFeaturedGroupForm(f => ({ ...f, display_mode: e.target.value as any }))}
                                    >
                                        <option value="comparison">瀵规瘮妯″紡锛堢湡瀹?vs AI锛?/option>
                                        <option value="side_by_side">骞舵帓妯″紡锛堢湡瀹炲拰AI锛?/option>
                                        <option value="normal">鏅€氭ā寮忥紙鍗曚釜妗堜緥锛?/option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>绗竴涓渚?*</label>
                                    <select
                                        className="form-input"
                                        value={featuredGroupForm.case1_id}
                                        onChange={(e) => setFeaturedGroupForm(f => ({ ...f, case1_id: e.target.value }))}
                                    >
                                        <option value="">璇烽€夋嫨妗堜緥</option>
                                        {templates.filter(t => t.status === 'published').map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {featuredGroupForm.display_mode !== 'normal' && (
                                    <div className="form-group">
                                        <label>绗簩涓渚?*</label>
                                        <select
                                            className="form-input"
                                            value={featuredGroupForm.case2_id}
                                            onChange={(e) => setFeaturedGroupForm(f => ({ ...f, case2_id: e.target.value }))}
                                        >
                                            <option value="">璇烽€夋嫨妗堜緥</option>
                                            {templates.filter(t => t.status === 'published' && t.id !== featuredGroupForm.case1_id).map(t => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>绗竴涓渚嬫爣绛?/label>
                                        <input
                                            className="form-input"
                                            value={featuredGroupForm.case1_label}
                                            onChange={(e) => setFeaturedGroupForm(f => ({ ...f, case1_label: e.target.value }))}
                                            placeholder="渚嬪锛氱湡瀹?
                                        />
                                    </div>
                                    {featuredGroupForm.display_mode !== 'normal' && (
                                        <div className="form-group">
                                            <label>绗簩涓渚嬫爣绛?/label>
                                            <input
                                                className="form-input"
                                                value={featuredGroupForm.case2_label}
                                                onChange={(e) => setFeaturedGroupForm(f => ({ ...f, case2_label: e.target.value }))}
                                                placeholder="渚嬪锛欰I"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>鎺掑簭椤哄簭</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={featuredGroupForm.sort_order}
                                        onChange={(e) => setFeaturedGroupForm(f => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                                        placeholder="鏁板瓧瓒婂皬瓒婇潬鍓?
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setShowFeaturedGroupModal(false)}>鍙栨秷</button>
                                <button
                                    className="btn-primary"
                                    onClick={selectedFeaturedGroup ? handleUpdateFeaturedGroup : handleCreateFeaturedGroup}
                                    disabled={actionLoading === 'create-group' || actionLoading === 'update-group'}
                                >
                                    {actionLoading === 'create-group' || actionLoading === 'update-group' ? '淇濆瓨涓?..' : '淇濆瓨'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Templates;

