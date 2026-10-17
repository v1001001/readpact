package com.soybean.quick.service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.soybean.quick.common.ResultCode;
import com.soybean.quick.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Hash;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.math.BigInteger;
import java.util.*;
@Service
@RequiredArgsConstructor
public class ChainBookService {
    private final ObjectMapper json;
    @Value("${readpact.rpc-url:https://testnet-rpc.monad.xyz}") private String rpcUrl;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    public String bookId(String contract,String challengeId) {
        try {
            String selector=Hash.sha3String("challenges(uint256)").substring(0,10);
            String data=selector+String.format("%064x",new BigInteger(challengeId));
            String body=json.writeValueAsString(Map.of("jsonrpc","2.0","id",1,"method","eth_call","params",List.of(Map.of("to",contract,"data",data),"latest")));
            var request=HttpRequest.newBuilder(URI.create(rpcUrl)).timeout(Duration.ofSeconds(15)).header("Content-Type","application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200) throw new IllegalStateException("RPC unavailable");
            String value=json.readTree(response.body()).path("result").asText();
            if(!value.matches("0x[0-9a-fA-F]{128,}") || new BigInteger(value.substring(66,130),16).signum()==0) throw new BusinessException(ResultCode.NOT_FOUND);
            return value.substring(0,66).toLowerCase(Locale.ROOT);
        } catch(BusinessException e) {throw e;}
        catch(InterruptedException e) {Thread.currentThread().interrupt(); throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),"链上信息暂不可验证，请重试");}
        catch(Exception e) {throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),"链上信息暂不可验证，请重试");}
    }
}
