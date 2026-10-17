package com.soybean.quick;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.Set;

@SpringBootApplication
@MapperScan("com.soybean.quick.mapper")
public class BackApplication {

    /**
     * No-argument launches use production configuration for the company release platform. TEST/dev
     * aliases opt into local H2; Spring profile arguments and environment overrides remain
     * supported.
     */
    private static final Set<String> PROD_ALIASES =
            Set.of("PROD", "prod", "--prod", "production", "Production", "PRODUCTION");

    public static void main(String[] args) {
        if (System.getProperty("spring.profiles.active") == null
                && System.getenv("SPRING_PROFILES_ACTIVE") == null) {
            String profile = resolveProfile(args);
            System.setProperty("spring.profiles.active", profile);
        }
        SpringApplication.run(BackApplication.class, args);
    }

    static String resolveProfile(String[] args) {
        if (args == null || args.length == 0) {
            return "prod";
        }
        for (String raw : args) {
            if (raw == null) {
                continue;
            }
            String token = raw.trim();
            if (token.isEmpty()) {
                continue;
            }
            if (Set.of("test", "--test", "dev", "--dev").contains(token.toLowerCase())) {
                return "test";
            }
            if (PROD_ALIASES.contains(token) || PROD_ALIASES.contains(token.toLowerCase())) {
                return "prod";
            }
        }
        return "prod";
    }
}
