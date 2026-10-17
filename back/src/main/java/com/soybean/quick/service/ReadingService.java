package com.soybean.quick.service;

import com.soybean.quick.common.ResultCode;
import com.soybean.quick.dto.*;
import com.soybean.quick.entity.ReadingSubmission;
import com.soybean.quick.exception.BusinessException;
import com.soybean.quick.mapper.ReadingSubmissionMapper;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReadingService {
    private final ReadingSubmissionMapper repository;
    private final ReadingDtoMapper mapper;
    private final BookService books;
    private final ChainBookService chain;

    @Value("${readpact.contract-address:}")
    private String contractAddress;

    @Value("${readpact.rpc-url:https://testnet-rpc.monad.xyz}")
    private String rpcUrl;

    private static final long CHAIN_ID = 10143;
    public ReadingDtos.Config config() {
        return new ReadingDtos.Config(
                3, CHAIN_ID, rpcUrl, contractAddress, "https://testnet.monadscan.com", "ReadPact 共读书架");
    }

    public ReadingDtos.Submission prepare(ReadingDtos.Prepare request) {
        books.checkAnswer(request.bookId(),request.day(),request.answer());
        if (!contractAddress.matches("0x[0-9a-fA-F]{40}")) throw bad("合约尚未部署配置");
        if (!chain.bookId(contractAddress,request.challengeId()).equalsIgnoreCase(request.bookId())) throw bad("书籍与链上挑战不一致");
        String reflection = request.reflection().strip();
        if (reflection.length() < 10) throw bad("请写至少 10 个字的具体感想");
        long expiry = Instant.now().getEpochSecond() + 600;
        String message =
                "ReadPact reading submission\nChain: "
                        + CHAIN_ID
                        + "\nContract: "
                        + contractAddress.toLowerCase(Locale.ROOT)
                        + "\nChallenge: "
                        + request.challengeId()
                        + "\nBook: "
                        + request.bookId().toLowerCase(Locale.ROOT)
                        + "\nDay: "
                        + request.day()
                        + "\nWallet: "
                        + request.wallet().toLowerCase(Locale.ROOT)
                        + "\nAnswer: "
                        + request.answer()
                        + "\nReflection: "
                        + reflection
                        + "\nNonce: "
                        + UUID.randomUUID()
                        + "\nExpires: "
                        + expiry;
        var row = new ReadingSubmission();
        row.setContentHash(hash(message));
        row.setBookId(request.bookId().toLowerCase(Locale.ROOT));
        row.setContractAddress(contractAddress.toLowerCase(Locale.ROOT));
        row.setAnswer(request.answer());
        row.setWallet(request.wallet().toLowerCase(Locale.ROOT));
        row.setChallengeId(request.challengeId());
        row.setReadingDay(request.day());
        row.setReflection(reflection);
        row.setSigningMessage(message);
        row.setExpiresAt(expiry);
        repository.insert(row);
        return mapper.toDto(row);
    }

    public ReadingDtos.Submission confirm(ReadingDtos.Confirm request) {
        var row = repository.selectById(request.contentHash());
        if (row == null) throw bad("内容不存在");
        if (row.getSignature() != null) return mapper.toDto(row);
        if (Instant.now().getEpochSecond() >= row.getExpiresAt()) throw bad("签名已过期，请重新提交");
        if (!recover(row.getSigningMessage(), request.signature())
                .equalsIgnoreCase(row.getWallet())) throw bad("签名钱包与提交者不一致");
        row.setSignature(request.signature());
        repository.updateById(row);
        return mapper.toDto(row);
    }

    public ReadingDtos.Submission get(String hash) {
        var row = repository.selectById(hash);
        if (row == null || row.getSignature() == null)
            throw new BusinessException(ResultCode.NOT_FOUND);
        return mapper.toDto(row);
    }

    public static String hash(String message) {
        try {
            return "0x"
                    + HexFormat.of()
                            .formatHex(
                                    MessageDigest.getInstance("SHA-256")
                                            .digest(message.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String recover(String message, String signature) {
        try {
            byte[] b = Numeric.hexStringToByteArray(signature);
            if (b.length != 65) throw bad("签名长度错误");
            byte v = b[64];
            if (v < 27) v += 27;
            var data =
                    new Sign.SignatureData(
                            v, Arrays.copyOfRange(b, 0, 32), Arrays.copyOfRange(b, 32, 64));
            return "0x"
                    + Keys.getAddress(
                            Sign.signedPrefixedMessageToKey(
                                    message.getBytes(StandardCharsets.UTF_8), data));
        } catch (Exception e) {
            throw bad("无法验证钱包签名");
        }
    }

    private static BusinessException bad(String message) {
        return new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
    }
}
