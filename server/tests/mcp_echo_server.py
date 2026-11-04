"""Tiny MCP stdio server used by tests."""
from mcp.server.mcpserver import MCPServer

srv = MCPServer("echo")


@srv.tool()
def echo(text: str, times: int = 1) -> str:
    """Repeat text."""
    return text * times


@srv.tool()
def fail(msg: str) -> str:
    """Always errors."""
    raise ValueError(msg)


if __name__ == "__main__":
    srv.run("stdio")
