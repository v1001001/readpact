package com.soybean.quick.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.soybean.quick.entity.ReadingDemo;
import org.apache.ibatis.annotations.*;
@Mapper
public interface ReadingDemoMapper extends BaseMapper<ReadingDemo> {
 @Update("UPDATE reading_demos SET reflection=#{reflection}, submitted=TRUE WHERE id='algorithms' AND submitted=FALSE")
 int submit(@Param("reflection") String reflection);
 @Update("UPDATE reading_demos SET witness_one=TRUE WHERE id='algorithms' AND submitted=TRUE")
 int confirmOne();
 @Update("UPDATE reading_demos SET witness_two=TRUE WHERE id='algorithms' AND submitted=TRUE")
 int confirmTwo();
 @Update("UPDATE reading_demos SET reflection='', submitted=FALSE, witness_one=FALSE, witness_two=FALSE WHERE id='algorithms'")
 int reset();
}
