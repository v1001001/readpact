package com.soybean.quick.dto;

import com.soybean.quick.entity.ReadingSubmission;
import com.soybean.quick.entity.ReadingBook;

import org.mapstruct.Mapper;
import org.mapstruct.ReportingPolicy;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface ReadingDtoMapper {
    ReadingDtos.Book toDto(ReadingBook source);
    DemoDtos.Progress toDto(com.soybean.quick.entity.ReadingDemo source);
    @org.mapstruct.Mapping(source = "readingDay", target = "day")
    ReadingDtos.Submission toDto(ReadingSubmission source);
}
