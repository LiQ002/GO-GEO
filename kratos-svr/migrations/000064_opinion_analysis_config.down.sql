-- 000064 down: 移除舆情总结 purpose 关联（feature=8 为纯枚举扩展，无需回滚数据）。
DELETE FROM cfg_writing_model_purposes WHERE purpose = 10;
