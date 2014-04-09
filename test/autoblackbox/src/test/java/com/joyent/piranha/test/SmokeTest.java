package com.joyent.piranha.test;

import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.*;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static com.joyent.piranha.pageobject.Account.Legend.BillingInformation;
import static com.joyent.piranha.pageobject.Account.Legend.SSH;
import static com.joyent.piranha.pageobject.Account.Legend.YouProfile;
import static com.joyent.piranha.pageobject.NavBarMenu.NavBarFooterElement.SystemStatus;
import static com.joyent.piranha.pageobject.NavBarMenu.NavBarHeaderElement.DevCenter;
import static com.joyent.piranha.pageobject.NavBarMenu.NavBarHeaderElement.MyAccount;
import static com.joyent.piranha.pageobject.NavBarMenu.NavBarHeaderElement.Support;

public class SmokeTest extends TestWrapper {
    public static final String USER_NAME = System.getProperty("loginusr");
    public static final String PASSWORD = System.getProperty("loginpw");
    public static final String DATACENTER = System.getProperty("datacenter");
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        page(Dashboard.class).getCountInstancesRunning().shouldNotHave(text("0"));
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @Before
    public void goToDashboard() {
        sideBarMenu.clickDashboard();
    }

    @AfterClass
    public static void endClass() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @After
    public void logout() {
        sideBarMenu.errorNotPresent();
    }

    @Test
    public void dashboardIsVisible() {
        final Dashboard dashboard = sideBarMenu.clickDashboard();
        dashboard.checkHeadingDashboard();
        dashboard.getCountInstancesRunning().shouldNotHave(text("0"));

        navBarMenu.getNavBarElement(DevCenter).shouldBe(visible);
        navBarMenu.getNavBarElement(Support).shouldBe(visible);
        navBarMenu.getNavBarElement(SystemStatus).shouldBe(visible);
        navBarMenu.getNavBarElement(MyAccount).shouldBe(visible);
    }

    @Test
    public void instanceListIsVisible() {
        Instances instances = sideBarMenu.clickCompute();
        instances.waitingLoading();

        instances.checkTitle();
        instances.clickActionsButton();
        instances.getListActions().shouldBe(visible);

        instances.clickColumnsButton();
        instances.getCheckboxListColumns().shouldBe(visible);
    }

    @Test
    public void instanceAnalyticsIsVisible() {
        Instances instances = sideBarMenu.clickCompute();
        instances.waitingLoading();
        instances.checkTitle();
        instances.errorNotPresent();

        InstanceDetails instanceDetails = instances.getInstanceList().clickFirstInstance();

        instanceDetails.checkTitle();
        instanceDetails.getChartElements().shouldHaveSize(3);
        final Analytics analytics = instanceDetails.clickDetailedAnalytics();

        analytics.getSelectInstanceLabel().shouldBe(visible);
        analytics.getStartAnalyticsButton().shouldBe(visible);
    }

    @Test
    public void storagePageIsVisible() {
        final Storage storage = sideBarMenu.clickStorage();
        storage.errorNotPresent();
        storage.checkTitle();
    }

    @Test
    public void accountSummaryIsVisible() {
        final AccountMenu accountMenu = navBarMenu.clickAccountMenu();
        final Account account = accountMenu.clickAccount();

        account.checkTitle();
        account.getLabel(YouProfile).should(visible);
        account.getLabel(BillingInformation).should(visible);
        account.getLabel(SSH).should(visible);
        account.getSSHContainer().getKeyNameLabel().shouldHave(text("Key Name / UUID"));
        final EditProfile editProfile = account.clickEditProfile();
        editProfile.checkTitle();
        editProfile.checkBreadcrumb("Account", "");

        navBarMenu.clickAccountMenu().clickAccount();
        final EditBillingInformation editBillingInformation = account.clickEditBilling();
        editBillingInformation.checkTitle();
        editBillingInformation.checkBreadcrumb("Account", "");

        navBarMenu.clickAccountMenu().clickAccount();
        account.getSSHContainer().clickELBApi().getFingerprintLabel().shouldBe(visible);
    }

    @Test
    public void createInstanceCarouselIsVisible() {
        String instanceName = "selenide-created-instance";
        String[] inst = Common.instanceProperties();
        final Dashboard dashboard = sideBarMenu.clickDashboard();
        final CreateInstanceQuickStart createInstanceQuickStart = dashboard.clickCreateComputeInstance();
        createInstanceQuickStart.checkTitle();
        CreateInstance createInstance = createInstanceQuickStart.clickViewMoreImages();
        createInstance.selectDataCenter(DATACENTER);
        createInstance.waitUntilPageIsActive(0);
        createInstance.selectOsFilter("smartos");
        createInstance.selectOsImage(inst[0]);
        createInstance.waitUntilPageIsActive(1);
        createInstance.selectPackage(inst[3]);
        createInstance.clickReviewBtn();
        createInstance.checkSelectedImageDescription(inst[4]);
        createInstance.checkPackageInfo(inst[5], inst[6], inst[7], inst[3]);
        createInstance.checkPaymentInfo(inst[8], inst[9]);
        createInstance.setInstanceNameValue(instanceName);
        createInstance.selectNetwork(0);
        createInstance.clickCreateInstanceButton();
        createInstance.cancelInstanceCreation();
    }

    @Test
    public void logoutAndLogIn() {
        Common.forceLogout();
        Login loginPage = page(Login.class);
        $(byText("Already a customer?")).shouldBe(visible);
        $(byText("New to Joyent?")).shouldBe(visible);
        loginPage.clickSignInOnLandingPage();
        loginPage.login(USER_NAME, "lol");
        loginPage.getErrorLabel().shouldHave(text("The username or password is incorrect"));
        loginPage.getInfoLabel().shouldHave(text("Reminder: username and password are case sensitive"));
        loginPage.login(USER_NAME, PASSWORD);
        sideBarMenu.clickDashboard().getCountInstancesRunning().shouldNotHave(text("0"));
    }
    @Ignore //until SSO is not fixed
    @Test
    public void changePassword() {
        ChangePassword changePassword = navBarMenu.clickAccountMenu().clickChangePassword();
        Common.switchWindow($(byText("Current Password")));
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().shouldHave(text("Must provide username and password"));

        changePassword.setOldPassword("qqqq");
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().shouldHave(text("The credentials provided are invalid"));

        changePassword.setOldPassword(PASSWORD);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().shouldHave(text("Password is too short"));

        String testPass = "newTestPass";
        changePassword.fillForm(PASSWORD, testPass);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().shouldHave(text("Sorry, please use a different password."));
        changePassword.getInfoLabel().shouldHave(text("To change your password, enter the new password twice, please use a combination of letters, numbers and symbols."));

        String previousPass = "qwerty1";
        changePassword.fillForm(PASSWORD, previousPass);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().shouldHave(text("You used this password recently. Please choose a new password."));

        WebDriverRunner.getWebDriver().close();
        Common.switchWindow(page(Dashboard.class).getCountInstancesRunning());
    }
}
