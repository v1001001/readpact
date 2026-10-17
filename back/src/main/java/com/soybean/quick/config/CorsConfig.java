package com.soybean.quick.config;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS 配置。允许的源由 {@code app.cors.allowed-origins} 控制（逗号分隔）。
 *
 * <p>默认值 {@code *} 仅用于 dev/test profile；生产 {@code application-prod.properties}
 * 会覆盖为业务前端域名白名单。也可用环境变量 {@code APP_CORS_ALLOWED_ORIGINS} 覆盖。
 *
 * <p>注意：当 allowCredentials=true 时，{@link CorsRegistry#allowedOriginPatterns}
 * 才能配合 {@code *}；若白名单是具体域名，应该用 {@link CorsRegistry#allowedOrigins}。
 * 这里统一走 {@code allowedOriginPatterns}：它对 {@code *} 与具体域名都接受，
 * 且对子域通配（如 {@code https://*.dushu365.com}）原生支持。
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(@Value("${app.cors.allowed-origins:*}") String allowedOriginsCsv) {
        this.allowedOrigins =
                Arrays.stream(allowedOriginsCsv.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .collect(Collectors.toList());
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
