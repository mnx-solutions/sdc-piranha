package test;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;

import org.junit.*;

import pageobjects.Common;
import pageobjects.FirewallPage;
import util.TestWrapper;

public class FirewallTests extends TestWrapper {
    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
        Common.login();
    }

    @AfterClass
    public static void logout() {
        open("/landing/forgetToken");
    }

    @After
    public void checkErrors() {
        Common.errorNotPresent();
    }

    @Before
    public void goToFirewall() {
        Common.openFirewallPage();
    }

    @Test
    public void RuleCreateValidation() {
        FirewallPage.clickAddNewButton();
        FirewallPage.createRuleButton().shouldBe(visible);
        FirewallPage.selectProtocol("UDP");
        FirewallPage.clickUseAllButton();
        FirewallPage.selectTargetValue("From", "IP", "192.168.123.23");
        FirewallPage.selectTargetValue("To", "All my VMs in DC", "");
        FirewallPage.createRuleButton().shouldBe(enabled);
        FirewallPage.removeFirstOption("protocol");
        FirewallPage.createRuleButton().click();
        $(".modal-body p").shouldHave(text("A Protocol condition is needed in the firewall rule"));
        Common.clickButtonInModal("Ok");
        FirewallPage.selectProtocol("UDP");
        FirewallPage.clickUseAllButton();
        FirewallPage.removeFirstOption("from");
        FirewallPage.createRuleButton().click();
        $(".modal-body p").shouldHave(text("A From condition is needed in the firewall rule"));
        Common.clickButtonInModal("Ok");
        FirewallPage.selectTargetValue("From", "IP", "192.168.123.23");
        FirewallPage.removeFirstOption("to");
        FirewallPage.createRuleButton().click();
        $(".modal-body p").shouldHave(text("A To condition is needed in the firewall rule"));
        FirewallPage.clickCancelCreateButton();
        Common.clickButtonInModal("Ok");
    }

    @Test
    public void editRule() {
        String tag = FirewallPage.createTestRule();
        $(".loading-large").waitWhile(visible, 60000);
        FirewallPage.editRule(tag);
        FirewallPage.removeFirstOption("Protocol");
        FirewallPage.removeFirstOption("From");
        FirewallPage.removeFirstOption("To");
        FirewallPage.selectProtocol("UDP");
        FirewallPage.clickUseAllButton();
        FirewallPage.selectTargetValue("From", "Tag", tag);
        FirewallPage.selectTargetValue("To", "All my VMs in DC", "");
        FirewallPage.createRuleButton().click();
        $(".loading-large").waitWhile(visible, 60000);
        FirewallPage.checkRuleParametersByTag(tag, "allow", "udp", tag, "All my VMs in DC");
        FirewallPage.removeFirstRule();
    }

    @Test
    public void CreateRule() {
        FirewallPage.clickAddNewButton();
        FirewallPage.clickUseAllButton();
        FirewallPage.selectTargetValue("From", "Instance", "forFIre\n");
        FirewallPage.selectTargetValue("To", "Tag", "notAnInstance");
        FirewallPage.createRuleButton().click();
        $(".loading-large").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
        $(".item-list-container").shouldBe(visible);
        $(".item-list-container").$(byText("tag: notAnInstance")).shouldBe(visible);
        FirewallPage.removeFirstRule();
    }
}