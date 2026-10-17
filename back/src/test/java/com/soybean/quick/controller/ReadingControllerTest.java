package com.soybean.quick.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.mock.mockito.MockBean;
import com.soybean.quick.service.ChainBookService;
import static org.mockito.Mockito.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.web3j.crypto.*;
import org.web3j.utils.Numeric;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@ActiveProfiles("test")
@SpringBootTest(
        properties = {
            "readpact.contract-address=0x1111111111111111111111111111111111111111",
            "spring.datasource.url=jdbc:h2:mem:readingtest;MODE=MySQL;DB_CLOSE_DELAY=-1"
        })
@AutoConfigureMockMvc
class ReadingControllerTest {
    @Autowired MockMvc mvc;
    @Autowired com.soybean.quick.mapper.ReadingBookMapper books;
    @MockBean ChainBookService chain;
    private static final String BOOK=Hash.sha3String("naval-almanack-v1");
    @BeforeEach void chainBook() { when(chain.bookId(anyString(),anyString())).thenReturn(BOOK); }

    @Autowired ObjectMapper json;

    private String postJson(String path, Object body) throws Exception {
        return mvc.perform(
                        post("/api/readpact" + path)
                                .contentType("application/json")
                                .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    @Transactional
    void databaseDemoRequiresSubmissionAndTwoDistinctConfirmations() throws Exception {
        var initial=mvc.perform(get("/api/readpact/demos/algorithms")).andReturn().getResponse().getContentAsString();
        assertEquals(21,json.readTree(initial).path("data").path("currentDay").asInt());
        assertEquals(17,json.readTree(initial).path("data").path("completedDays").asText().split(",").length);
        var premature=postJson("/demos/algorithms/confirm",Map.of("witness",1));
        assertNotEquals(200,json.readTree(premature).path("code").asInt());
        var wrong=postJson("/demos/algorithms/submit",Map.of("answer",2,"reflection","这是用于验证演示阅读流程的感想内容。"));
        assertNotEquals(200,json.readTree(wrong).path("code").asInt());
        postJson("/demos/algorithms/submit",Map.of("answer",1,"reflection","这是用于验证演示阅读流程的感想内容。"));
        postJson("/demos/algorithms/confirm",Map.of("witness",1));
        var repeated=postJson("/demos/algorithms/confirm",Map.of("witness",1));
        assertFalse(json.readTree(repeated).path("data").path("witnessTwo").asBoolean());
        postJson("/demos/algorithms/confirm",Map.of("witness",2));
        var persisted=mvc.perform(get("/api/readpact/demos/algorithms")).andReturn().getResponse().getContentAsString();
        assertTrue(json.readTree(persisted).path("data").path("witnessOne").asBoolean());
        assertTrue(json.readTree(persisted).path("data").path("witnessTwo").asBoolean());
        assertTrue(json.readTree(persisted).path("data").path("submitted").asBoolean());
        var reset=postJson("/demos/algorithms/reset",Map.of());
        assertFalse(json.readTree(reset).path("data").path("submitted").asBoolean());
        assertFalse(json.readTree(reset).path("data").path("witnessOne").asBoolean());
    }

    private String signature(String message, ECKeyPair key) {
        var s = Sign.signPrefixedMessage(message.getBytes(StandardCharsets.UTF_8), key);
        return Numeric.toHexString(s.getR())
                + Numeric.toHexStringNoPrefix(s.getS())
                + Numeric.toHexStringNoPrefix(s.getV());
    }

    @Test
    void readingContentRequiresCorrectWalletSignatureAndPersists() throws Exception {
        var key = Keys.createEcKeyPair();
        String wallet = "0x" + Keys.getAddress(key);
        var prepared =
                json.readTree(
                                postJson(
                                        "/submissions/prepare",
                                        Map.of(
                                                "bookId", BOOK,
                                                "challengeId",
                                                "1",
                                                "day",
                                                0,
                                                "wallet",
                                                wallet,
                                                "answer",
                                                1,
                                                "reflection",
                                                "我准备每天阅读二十分钟，并把一个观点写成具体行动。")))
                        .get("data");
        assertNotNull(prepared);
        String hash = prepared.get("contentHash").asText();
        String message = prepared.get("signingMessage").asText();
        mvc.perform(get("/api/readpact/submissions/" + hash))
                .andExpect(jsonPath("$.code").value(404));
        var rejected =
                json.readTree(
                        postJson(
                                "/submissions/confirm",
                                Map.of(
                                        "contentHash",
                                        hash,
                                        "signature",
                                        signature(message, Keys.createEcKeyPair()))));
        assertEquals(400, rejected.get("code").asInt());
        var confirmed =
                json.readTree(
                        postJson(
                                "/submissions/confirm",
                                Map.of("contentHash", hash, "signature", signature(message, key))));
        assertEquals(200, confirmed.get("code").asInt());
        mvc.perform(get("/api/readpact/submissions/" + hash))
                .andExpect(jsonPath("$.data.day").value(0))
                .andExpect(jsonPath("$.data.wallet").value(wallet))
                .andExpect(jsonPath("$.data.signingMessage").value(message));
    }

    @Test
    void wrongAnswerDoesNotProduceSubmission() throws Exception {
        var result =
                json.readTree(
                        postJson(
                                "/submissions/prepare",
                                Map.of(
                                        "bookId", BOOK,
                                        "challengeId",
                                        "1",
                                        "day",
                                        0,
                                        "wallet",
                                        "0x1111111111111111111111111111111111111111",
                                        "answer",
                                        0,
                                        "reflection",
                                        "这是一份用于验证错误答案不会生成凭证的感想。")));
        assertEquals(400, result.get("code").asInt());
    }

    @Test @Transactional
    void catalogIsDatabaseBackedAndTasksAreBookSpecific() throws Exception {
        mvc.perform(get("/api/readpact/books")).andExpect(jsonPath("$.data.length()").value(8));
        var book = books.selectById(Hash.sha3String("algorithms-to-live-by-v1"));
        book.setTitle("Updated catalog title");
        books.updateById(book);
        mvc.perform(get("/api/readpact/books")).andExpect(jsonPath("$.data[0].title").value("Updated catalog title"));
        String other=Hash.sha3String("ethereum-v1");
        mvc.perform(get("/api/readpact/books/"+other+"/tasks/0")).andExpect(jsonPath("$.data.title").value("智能合约"));
        mvc.perform(get("/api/readpact/books/"+BOOK+"/tasks/0")).andExpect(jsonPath("$.data.title").value("长期主义"));
        mvc.perform(get("/api/readpact/books/"+Hash.sha3String("missing")+"/tasks/0")).andExpect(jsonPath("$.code").value(404));
    }
    @Test
    void cannotUseAnotherBooksTaskForOnChainChallenge() throws Exception {
        var result=json.readTree(postJson("/submissions/prepare",Map.of("bookId",Hash.sha3String("ethereum-v1"),"challengeId","1","day",0,"wallet","0x1111111111111111111111111111111111111111","answer",1,"reflection","这是一个验证书籍和链上挑战必须一致的阅读感想。")));
        assertEquals(400,result.get("code").asInt());
        assertTrue(result.get("message").asText().contains("书籍"));
    }
    @Test
    void rejectsMalformedAndOutOfRangeInput() throws Exception {
        mvc.perform(
                        post("/api/readpact/submissions/prepare")
                                .contentType("application/json")
                                .content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/readpact/books/"+BOOK+"/tasks/21")).andExpect(jsonPath("$.code").value(400));
    }
}
