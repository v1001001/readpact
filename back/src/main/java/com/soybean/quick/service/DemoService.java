package com.soybean.quick.service;
import com.soybean.quick.dto.*;
import com.soybean.quick.mapper.ReadingDemoMapper;
import com.soybean.quick.common.ResultCode;
import com.soybean.quick.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
@Service
@RequiredArgsConstructor
public class DemoService {
 private final ReadingDemoMapper demos;
 private final ReadingDtoMapper mapper;
 private final BookService books;
 public DemoDtos.Progress get() {
  var row=demos.selectById("algorithms");
  if(row==null) throw new BusinessException(ResultCode.NOT_FOUND);
  return mapper.toDto(row);
 }
 public DemoDtos.Progress submit(DemoDtos.Submit request) {
  var row=get();
  books.checkAnswer(row.bookId(),0,request.answer());
  if(request.reflection().trim().length()<10) throw new BusinessException(ResultCode.BAD_REQUEST);
  demos.submit(request.reflection().trim());
  return get();
 }
 public DemoDtos.Progress reset() { demos.reset(); return get(); }
 public DemoDtos.Progress confirm(DemoDtos.Confirm request) {
  if(!get().submitted()) throw new BusinessException(ResultCode.BAD_REQUEST);
  if(request.witness()==1) demos.confirmOne(); else demos.confirmTwo();
  return get();
 }
}
