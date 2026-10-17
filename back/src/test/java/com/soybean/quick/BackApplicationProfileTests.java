package com.soybean.quick;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

/** 纯 JUnit 单测，不启动 Spring 上下文。 覆盖 BackApplication.resolveProfile 的 argv 解析逻辑。 */
class BackApplicationProfileTests {

    @Test
    void defaultsToProd_whenArgsEmpty() {
        assertEquals("prod", BackApplication.resolveProfile(new String[0]));
        assertEquals("prod", BackApplication.resolveProfile(null));
    }

    @Test
    void returnsProd_forProdAliases() {
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"PROD"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"prod"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"--prod"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"production"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"Production"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"PRODUCTION"}));
    }

    @Test
    void ignoresUnknownArgs() {
        assertEquals("test", BackApplication.resolveProfile(new String[] {"dev"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"foo", "bar"}));
        assertEquals("prod", BackApplication.resolveProfile(new String[] {""}));
    }

    @Test
    void explicitLocalAliasesUseTest() {
        assertEquals("test", BackApplication.resolveProfile(new String[] {"TEST"}));
        assertEquals("test", BackApplication.resolveProfile(new String[] {"--dev"}));
    }

    @Test
    void findsProdAnywhereInArgs() {
        assertEquals("prod", BackApplication.resolveProfile(new String[] {"foo", "PROD"}));
        assertEquals(
                "prod",
                BackApplication.resolveProfile(new String[] {"--server.port=9090", "prod"}));
    }
}
