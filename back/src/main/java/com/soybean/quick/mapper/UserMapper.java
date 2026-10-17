package com.soybean.quick.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.soybean.quick.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户 Mapper。
 * 用法：
 *   - 单条查询：lambdaQuery().eq(User::getUsername, name).one()
 *   - 分页：baseMapper.selectPage(Page.of(...), Wrappers.lambdaQuery())
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
}
