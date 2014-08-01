package com.joyent.piranha.test;

import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.util.TestWrapper;
import com.joyent.piranha.utils.InstanceParser;
import org.junit.*;

import java.io.FileNotFoundException;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static com.joyent.piranha.pageobject.Account.Legend.*;
import static com.joyent.piranha.pageobject.NavBarMenu.NavBarHeaderElement.*;

public class SmokeTest extends TestWrapper {
    public static  String USER_NAME;
    public static  String PASSWORD;
    public static final String DATACENTER = PropertyHolder.getDatacenter(0);
    public static final String ALREADY_USED_PASSWORD = "qwerty1";
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;
    private static Dashboard dashboard;
    private static InstanceVO instanceVO;

    @BeforeClass
    public static void prepareData() throws FileNotFoundException {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        instanceVO = InstanceParser.popInstance(DATACENTER);
        Login loginPage = open("/", Login.class);
        USER_NAME = loginPage.createTestAccount(loginPage.clickSignUp());
        page(CreateAccountPage.class).clickCreateAcccount(Dashboard.class);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
        dashboard = page(Dashboard.class);
        EditBillingInformation editBillingInformation = navBarMenu.clickAccountMenu().clickAccount().clickEditBilling();
        editBillingInformation.fillBillingInfoCorrectly();
        Account account = editBillingInformation.clickSaveChangesButton();
        account.clickButtonInModal("Ok");
        AccountSSH accountSSH = account.getSSHContainer();
        accountSSH.clickImportPublicKey();
        accountSSH.uploadFile(PropertyHolder.getPublicKeyPath());
        sideBarMenu.clickCompute();
        page(CreateInstanceManual.class).createInstance(instanceVO);
        changePassword(USER_NAME, ALREADY_USED_PASSWORD);
        PASSWORD = USER_NAME + "1";
        changePassword(ALREADY_USED_PASSWORD, PASSWORD);
    }

    private static void changePassword(String oldPassword, String newPassword) {
        ChangePassword changePassword = navBarMenu.clickAccountMenu().clickChangePassword();
        Common.switchWindow($(byText("Repeat password")));
        changePassword.setOldPassword(oldPassword);
        changePassword.setNewPassword(newPassword);
        changePassword.setConfirmNewPassword(newPassword);
        changePassword.clickSubmitButton();
        changePassword.clickCloseButton();
        Common.switchWindow(dashboard.getCountInstancesRunning());
    }

    @Before
    public void goToDashboard() {
        sideBarMenu.clickDashboard();
    }

    @AfterClass
    public static void endClass() throws InstantiationException, IllegalAccessException {
        sideBarMenu.clickCompute();
        Common.cleanUpGrid(InstanceList.class);
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void dashboardIsVisible() {
        sideBarMenu.clickDashboard();
        dashboard.checkHeadingDashboard();
        dashboard.getCountInstancesRunning().shouldNotHave(text("0"));

        navBarMenu.getNavBarElement(DevCenter).shouldBe(visible);
        navBarMenu.getNavBarElement(Support).shouldBe(visible);
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
        InstanceList instanceList = instances.getInstanceList();
        instanceList.openGridTab(DATACENTER);
        InstanceDetails instanceDetails = instanceList.clickFirstInstance();
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
    public void createInstanceCarouselIsVisible() throws FileNotFoundException {
        String instanceName = "selenide-created-instance";
        sideBarMenu.clickDashboard();
        final CreateInstanceManual createInstanceManual = dashboard.clickCreateComputeInstance();
        createInstanceManual.clickAllPublicImagesLink();
        createInstanceManual.waitUntilPageIsActive(0);
        createInstanceManual.selectOsFilter("smartos");
        createInstanceManual.selectDataCenter(DATACENTER);
        createInstanceManual.chooseImage(instanceVO.getImageName());
        createInstanceManual.waitUntilPageIsActive(1);
        createInstanceManual.selectPackage(instanceVO.getPackageName());
        createInstanceManual.clickReviewBtn();
        createInstanceManual.checkPackageInfo(instanceVO.getRam(), instanceVO.getDiskSpace(), instanceVO.getCpu(), instanceVO.getPackageVersion());
        createInstanceManual.checkPaymentInfo(instanceVO.getPricePerHour(), instanceVO.getPricePerMonth());
        createInstanceManual.setInstanceNameValue(instanceName);
        createInstanceManual.selectNetwork(0);
        createInstanceManual.clickCreateInstanceButton();
        createInstanceManual.cancelInstanceCreation();
    }

    @Test
    public void logoutAndLogIn() {
        Common.forceLogout();
        Login loginPage = page(Login.class);
        $(byText("Sign in to Joyent")).shouldBe(visible);
        $(byText("New to Joyent?")).shouldBe(visible);
        loginPage.clickSignIn();
        loginPage.login(USER_NAME, "lol");
        $(byText("The username or password is incorrect")).shouldBe(visible);
        $(byText("Reminder: username and password are case sensitive")).shouldBe(visible);
        loginPage.login(USER_NAME, PASSWORD);
        dashboard.getCountInstancesRunning().shouldNotHave(text("0"));
    }

    @Test
    public void changePassword() {
        dashboard.getFreeTierWidget().waitUntil(visible, timeout);
        ChangePassword changePassword = navBarMenu.clickAccountMenu().clickChangePassword();
        Common.switchWindow($(byText("Repeat password")));

        changePassword.setOldPassword(PASSWORD);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().get(0).shouldHave(text("Please enter new password."));

        String testPass = "incorrectPass";
        changePassword.fillForm(PASSWORD, testPass);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().get(0).shouldHave(text("To change your password, enter the new password twice, please use a combination of letters, numbers and symbols."));
        changePassword.getErrorLabel().get(1).shouldHave(text("Sorry, please use a different password."));

        changePassword.fillForm(PASSWORD, ALREADY_USED_PASSWORD);
        changePassword.clickSubmitButton();
        changePassword.getErrorLabel().get(1).shouldHave(text("You used this password recently. Please choose a new password."));

        WebDriverRunner.getWebDriver().close();
        Common.switchWindow(dashboard.getCountInstancesRunning());
    }
}
