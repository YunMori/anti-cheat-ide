from dataclasses import dataclass

from app.models import Language


@dataclass(frozen=True)
class LanguageProfile:
    image: str
    filename: str
    run_command: tuple[str, ...]
    compile_command: tuple[str, ...] | None = None


LANGUAGE_PROFILES: dict[Language, LanguageProfile] = {
    Language.PYTHON: LanguageProfile(
        image="python:3.12-alpine",
        filename="main.py",
        run_command=("python", "-I", "/tmp/main.py"),
    ),
    Language.JAVASCRIPT: LanguageProfile(
        image="node:22-alpine",
        filename="main.js",
        run_command=("node", "/tmp/main.js"),
    ),
    Language.CPP: LanguageProfile(
        image="gcc:14-bookworm",
        filename="main.cpp",
        compile_command=(
            "g++",
            "-O2",
            "-std=c++20",
            "-o",
            "/tmp/main",
            "/tmp/main.cpp",
        ),
        run_command=("/tmp/main",),
    ),
    Language.JAVA: LanguageProfile(
        image="eclipse-temurin:21-jdk-jammy",
        filename="Main.java",
        compile_command=("javac", "-d", "/tmp", "/tmp/Main.java"),
        run_command=("java", "-cp", "/tmp", "Main"),
    ),
}


def get_language_profile(language: Language) -> LanguageProfile:
    return LANGUAGE_PROFILES[language]
