package com.joyent.piranha.test;

import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.*;

import static com.codeborne.selenide.Condition.enabled;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;

public class FirewallTest extends TestWrapper {

    public static final String USER_NAME = System.getProperty("loginusr");
    public static final String PASSWORD = System.getProperty("loginpw");
    public static SideBarMenu sideBarMenu;
    public static NavBarMenu navBarMenu;
    public static FirewallRules firewallRules;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        sideBarMenu = page(SideBarMenu.class);
        navBarMenu = page(NavBarMenu.class);
        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        firewallRules = sideBarMenu.openFirewallPage();
    }

    @AfterClass
    public static void logout() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @After
    public void checkErrors() {
        sideBarMenu.errorNotPresent();
    }

    @Before
    public void goToFirewall() {
        sideBarMenu.openFirewallPage();
    }

    @Test
    public void ruleCreateValidation() {
        FirewallRuleDetails firewallRuleDetails = firewallRules.clickAddNewButton();
        firewallRuleDetails.getCreateRuleButton().shouldBe(visible);
        firewallRuleDetails.selectProtocol("UDP");
        firewallRuleDetails.clickUseAllButton();
        firewallRuleDetails.selectTargetValue("From", "IP", "192.168.123.23");
        firewallRuleDetails.selectTargetValue("To", "All my VMs in DC", "");
        firewallRuleDetails.getCreateRuleButton().shouldBe(enabled);
        firewallRuleDetails.removeFirstOption("protocol");
        firewallRuleDetails.getCreateRuleButton().click();
        firewallRuleDetails.getAlert().shouldHave(text("A Protocol condition is needed in the firewall rule"));
        firewallRuleDetails.clickButtonInModal("Ok");
        firewallRuleDetails.selectProtocol("UDP");
        firewallRuleDetails.clickUseAllButton();
        firewallRuleDetails.removeFirstOption("from");
        firewallRuleDetails.getCreateRuleButton().click();
        firewallRuleDetails.getAlert().shouldHave(text("A From condition is needed in the firewall rule"));
        firewallRuleDetails.clickButtonInModal("Ok");
        firewallRuleDetails.selectTargetValue("From", "IP", "192.168.123.23");
        firewallRuleDetails.removeFirstOption("to");
        firewallRuleDetails.getCreateRuleButton().click();
        firewallRuleDetails.getAlert().shouldHave(text("A To condition is needed in the firewall rule"));
        firewallRuleDetails.clickCancelCreateButton();
        firewallRuleDetails.clickButtonInModal("Ok");
    }

    @Test
    public void editRule() {
        String tag = firewallRules.createTestRule();
        firewallRules.waitForLargeSpinnerDisappear();
        FirewallRuleDetails firewallRuleDetails = firewallRules.editRule(tag);
        firewallRuleDetails.removeFirstOption("Protocol");
        firewallRuleDetails.removeFirstOption("From");
        firewallRuleDetails.removeFirstOption("To");
        firewallRuleDetails.selectProtocol("UDP");
        firewallRuleDetails.clickUseAllButton();
        firewallRuleDetails.selectTargetValue("From", "Tag", tag);
        firewallRuleDetails.selectTargetValue("To", "All my VMs in DC", "");
        firewallRuleDetails.getCreateRuleButton().click();
        firewallRules.waitForLargeSpinnerDisappear();
        firewallRules.checkRuleParametersByTag(tag, "Disabled", "allow", "udp all", tag, "All my VMs in DC");
        firewallRules.removeFirstRule();
    }

    @Test
    public void createRule() {
        FirewallRuleDetails firewallRuleDetails = firewallRules.clickAddNewButton();
        firewallRuleDetails.clickUseAllButton();
        firewallRuleDetails.selectTargetValue("From", "Instance", "dnd-forFIre\n");
        String instanceTag = "notAnInstance";
        firewallRuleDetails.selectTargetValue("To", "Tag", instanceTag);
        firewallRuleDetails.getCreateRuleButton().click();
        firewallRules.waitForLargeSpinnerDisappear();
        firewallRules.getTagFromGrid(instanceTag).shouldBe(visible);
        firewallRules.removeFirstRule();
    }
}