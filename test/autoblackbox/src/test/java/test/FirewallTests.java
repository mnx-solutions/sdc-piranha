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
        FirewallPage.addNewLinkClick();
        FirewallPage.createRuleBtn().shouldBe(visible);
        FirewallPage.selectProtocol("UDP");
        FirewallPage.useAllBtnClick();
        FirewallPage.selectSource("From", "IP", "192.168.123.23");
        FirewallPage.selectSource("To", "All my VMs in DC", "");
        FirewallPage.createRuleBtn().shouldBe(enabled);
        FirewallPage.removeFirstFromOption("protocol");
        FirewallPage.createRuleBtn().click();
        $(".modal-body p").shouldHave(text("A Protocol condition is needed in the firewall rule"));
        Common.clickOkInModal();
        FirewallPage.selectProtocol("UDP");
        FirewallPage.useAllBtnClick();
        FirewallPage.removeFirstFromOption("from");
        FirewallPage.createRuleBtn().click();
        $(".modal-body p").shouldHave(text("A From condition is needed in the firewall rule"));
        Common.clickOkInModal();
        FirewallPage.selectSource("From", "IP", "192.168.123.23");
        FirewallPage.removeFirstFromOption("to");
        FirewallPage.createRuleBtn().click();
        $(".modal-body p").shouldHave(text("A To condition is needed in the firewall rule"));
        Common.clickOkInModal();
    }

    @Test
    public void editRule() {
        String tag = FirewallPage.createTestRule();
        $(".loading-large").waitWhile(visible, 60000);
        FirewallPage.editFirstRuleOrByTag("tag: " + tag);
        FirewallPage.removeFirstFromOption("Protocol");
        FirewallPage.removeFirstFromOption("From");
        FirewallPage.removeFirstFromOption("To");
        FirewallPage.selectProtocol("UDP");
        FirewallPage.useAllBtnClick();
        FirewallPage.selectSource("From", "Tag", tag);
        FirewallPage.selectSource("To", "All my VMs in DC", "");
        FirewallPage.createRuleBtn().click();
        $(".loading-large").waitWhile(visible, 60000);
        FirewallPage.checkRuleParametersByTag(tag, "allow", "udp", tag, "All my VMs in DC");
        FirewallPage.removeFirstRule();
    }

    @Test
    public void CreateRule() {
        FirewallPage.addNewLinkClick();
        FirewallPage.useAllBtnClick();
        FirewallPage.selectSource("From", "Instance", "forFIre\n");
        FirewallPage.selectSource("To", "Tag", "notAnInstance");
        FirewallPage.createRuleBtn().click();
        $(".loading-large").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
        $(".item-list-container").shouldBe(visible);
        $(".item-list-container").$(byText("tag: notAnInstance")).shouldBe(visible);
        FirewallPage.removeFirstRule();
    }
}