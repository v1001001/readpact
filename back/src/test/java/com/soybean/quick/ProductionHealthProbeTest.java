package com.soybean.quick;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "spring.datasource.url=jdbc:h2:mem:productionprobe;MODE=MySQL;DB_CLOSE_DELAY=-1",
            "spring.datasource.driver-class-name=org.h2.Driver",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            // H2 does not support the production MySQL session setting.
            "spring.datasource.hikari.connection-init-sql=",
            "management.server.port=0"
        })
@ActiveProfiles("prod")
class ProductionHealthProbeTest {
    @Autowired Environment environment;
    @Autowired TestRestTemplate http;

    @Value("${local.management.port}")
    int managementPort;

    @Test
    void platformProbeGetsUpWithoutAuthenticationOrSensitiveDetails() {
        assertEquals("0.0.0.0", environment.getProperty("management.server.address"));
        assertEquals(
                "health", environment.getProperty("management.endpoints.web.exposure.include"));
        var response =
                http.getForEntity("http://127.0.0.1:" + managementPort + "/health", String.class);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UP", com.jayway.jsonpath.JsonPath.read(response.getBody(), "$.status"));
        assertFalse(response.getBody().contains("components"));
    }
}
