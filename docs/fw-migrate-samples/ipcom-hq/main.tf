# 模擬 IPCOM から変換した下書き。terraform validate はこのサンドボックスでは未実行。
resource "aws_networkfirewall_rule_group" "ipcom" {
  name     = "ipcom-hq-rules"
  type     = "STATEFUL"
  capacity = 16
  rule_group {
    stateful_rule_options {
      rule_order = "STRICT_ORDER"
    }
    rules_source {
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "TCP"
          source           = "ANY"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "172.16.20.10/32"
          destination_port = "80"
        }
        rule_option {
          keyword  = "sid"
          settings = ["10000"]
        }
      }
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "TCP"
          source           = "ANY"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "172.16.20.10/32"
          destination_port = "443"
        }
        rule_option {
          keyword  = "sid"
          settings = ["10001"]
        }
      }
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "TCP"
          source           = "ANY"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "172.16.20.11/32"
          destination_port = "25"
        }
        rule_option {
          keyword  = "sid"
          settings = ["11000"]
        }
      }
      stateful_rule {
        action = "DROP"
        header {
          protocol         = "TCP"
          source           = "ANY"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "ANY"
          destination_port = "22"
        }
        rule_option {
          keyword  = "sid"
          settings = ["12000"]
        }
      }
      stateful_rule {
        action = "REJECT"
        header {
          protocol         = "TCP"
          source           = "192.168.10.0/24"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "ANY"
          destination_port = "445"
        }
        rule_option {
          keyword  = "sid"
          settings = ["20000"]
        }
      }
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "IP"
          source           = "192.168.10.0/24"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "ANY"
          destination_port = "ANY"
        }
        rule_option {
          keyword  = "sid"
          settings = ["21000"]
        }
      }
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "UDP"
          source           = "172.16.20.0/24"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "ANY"
          destination_port = "53"
        }
        rule_option {
          keyword  = "sid"
          settings = ["30000"]
        }
      }
      stateful_rule {
        action = "PASS"
        header {
          protocol         = "TCP"
          source           = "172.16.20.0/24"
          source_port      = "ANY"
          direction        = "FORWARD"
          destination      = "ANY"
          destination_port = "53"
        }
        rule_option {
          keyword  = "sid"
          settings = ["30001"]
        }
      }
    }
  }
}

resource "aws_networkfirewall_firewall_policy" "ipcom" {
  name = "ipcom-hq-policy"
  firewall_policy {
    stateless_default_actions          = ["aws:forward_to_sfe"]
    stateless_fragment_default_actions = ["aws:forward_to_sfe"]
    stateful_default_actions           = ["aws:drop_strict", "aws:alert_strict"]
    stateful_engine_options {
      rule_order = "STRICT_ORDER"
    }
    stateful_rule_group_reference {
      priority     = 100
      resource_arn = aws_networkfirewall_rule_group.ipcom.arn
    }
  }
}
